// pst-extract — extract messages from an Outlook PST file as streaming JSONL.
//
// Usage:
//
//	pst-extract <pst-path> [flags]
//
// Each email (message class IPM.Note / SMIME / unmapped fallback) is emitted
// as one JSON object per line on stdout. Whitelisted attachments are written
// to --tmp-dir and referenced by path; other attachments are reported by
// name/size only. Progress and per-message errors go to stderr.
//
// The companion Python parser (treesearch/parsers/pst_parser.py) consumes
// this output and builds the search index.
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	pst "github.com/mooijtech/go-pst/v6/pkg"
	"github.com/mooijtech/go-pst/v6/pkg/properties"
)

type attachmentOut struct {
	Name string `json:"name"`
	Size int32  `json:"size"`
	Path string `json:"path"` // empty when not extracted
}

type emailOut struct {
	Folder   string          `json:"folder"`
	EntryID  int64           `json:"entry_id"`
	Subject  string          `json:"subject"`
	FromName string          `json:"from_name"`
	FromAddr string          `json:"from_addr"`
	To       string          `json:"to"`
	Cc       string          `json:"cc"`
	Date     string          `json:"date"`
	Body     string          `json:"body"`
	BodyHTML string          `json:"body_html"`
	Attach   []attachmentOut `json:"attachments"`
}

func sanitizeFilename(name string) string {
	name = strings.Map(func(r rune) rune {
		switch r {
		case '/', '\\', ':', '*', '?', '"', '<', '>', '|':
			return '_'
		}
		return r
	}, name)
	name = strings.TrimSpace(name)
	if len(name) > 80 {
		ext := filepath.Ext(name)
		name = name[:80-len(ext)] + ext
	}
	if name == "" {
		name = "unnamed"
	}
	return name
}

func extWhitelisted(name string, whitelist map[string]bool) bool {
	// "*" 通配：提取全部类型（2026-07-29 附件全量落盘供预览下载，ADR-0003）
	if whitelist["*"] {
		return true
	}
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
	return whitelist[ext]
}

func main() {
	pstPathFlag := flag.String("pst", "", "path to the PST file (required)")
	tmpDir := flag.String("tmp-dir", "", "directory for extracted attachments (required)")
	extsFlag := flag.String("attachment-exts", "", "comma-separated attachment extensions to extract (e.g. pdf,docx)")
	maxBytes := flag.Int64("max-attachment-bytes", 20*1024*1024, "max attachment size to extract")
	flag.Parse()

	pstPath := *pstPathFlag
	if pstPath == "" && flag.NArg() >= 1 {
		pstPath = flag.Arg(0) // positional fallback
	}
	if pstPath == "" {
		fmt.Fprintln(os.Stderr, "usage: pst-extract --pst <path> [--tmp-dir DIR] [--attachment-exts pdf,docx] [--max-attachment-bytes N]")
		os.Exit(2)
	}

	whitelist := map[string]bool{}
	for _, e := range strings.Split(*extsFlag, ",") {
		e = strings.TrimSpace(strings.ToLower(e))
		if e != "" {
			whitelist[e] = true
		}
	}

	if *tmpDir != "" {
		if err := os.MkdirAll(*tmpDir, 0o755); err != nil {
			fmt.Fprintf(os.Stderr, "error: cannot create tmp dir: %v\n", err)
			os.Exit(1)
		}
	}

	reader, err := os.Open(pstPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: open PST: %v\n", err)
		os.Exit(1)
	}
	pstFile, err := pst.New(reader)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: parse PST: %v\n", err)
		os.Exit(1)
	}
	defer func() {
		pstFile.Cleanup()
		reader.Close()
	}()

	// go-pst 库内部用 fmt.Printf 打诊断日志（如 message.go 的
	// "Unmapped message class ..."），直接写 os.Stdout，会混进 JSONL 流
	// 把一行 JSON 劈成两段。这里把 os.Stdout 换成管道并转储到 stderr，
	// JSON 编码器写事先保存的真实 stdout。
	realOut := os.Stdout
	if pr, pw, perr := os.Pipe(); perr == nil {
		os.Stdout = pw
		go func() {
			io.Copy(os.Stderr, pr)
		}()
		defer func() {
			pw.Close()
			os.Stdout = realOut
		}()
	}

	out := bufio.NewWriterSize(realOut, 256*1024)
	defer out.Flush()
	enc := json.NewEncoder(out)

	msgCount := 0
	errCount := 0
	start := time.Now()

	root, err := pstFile.GetRootFolder()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: get root folder: %v\n", err)
		os.Exit(1)
	}

	var walk func(folder *pst.Folder, prefix string)
	walk = func(folder *pst.Folder, prefix string) {
		folderPath := prefix + folder.Name

		it, err := folder.GetMessageIterator()
		if err == nil {
			for it.Next() {
				msg := it.Value()
				msgCount++
				if msgCount%200 == 0 {
					fmt.Fprintf(os.Stderr, "progress: %d messages (%s)\n", msgCount, time.Since(start).Round(time.Second))
				}
				if err := emitMessage(pstFile, msg, folderPath, enc, *tmpDir, whitelist, *maxBytes); err != nil {
					errCount++
					fmt.Fprintf(os.Stderr, "warn: message %d in %s: %v\n", msg.Identifier, folderPath, err)
				}
			}
			if it.Err() != nil {
				fmt.Fprintf(os.Stderr, "warn: iterator error in %s: %v\n", folderPath, it.Err())
			}
		}

		subs, err := folder.GetSubFolders()
		if err != nil {
			return
		}
		for i := range subs {
			walk(&subs[i], folderPath+"/")
		}
	}
	walk(&root, "")

	out.Flush()
	fmt.Fprintf(os.Stderr, "done: %d messages, %d errors, %s\n", msgCount, errCount, time.Since(start).Round(time.Second))
}

func emitMessage(pstFile *pst.File, msg *pst.Message, folderPath string, enc *json.Encoder, tmpDir string, whitelist map[string]bool, maxBytes int64) error {
	props, ok := msg.Properties.(*properties.Message)
	if !ok {
		// Contact / appointment / task / etc. — out of scope.
		return nil
	}

	entry := emailOut{
		Folder:   folderPath,
		EntryID:  int64(msg.Identifier),
		Subject:  props.GetSubject(),
		FromName: props.GetSenderName(),
		FromAddr: props.GetSenderEmailAddress(),
		To:       props.GetDisplayTo(),
		Cc:       props.GetDisplayCc(),
		Body:     props.GetBody(),
		BodyHTML: props.GetBodyHtml(),
		Attach:   []attachmentOut{},
	}
	if entry.FromAddr == "" {
		entry.FromAddr = props.GetSentRepresentingEmailAddress()
	}
	if ns := props.GetMessageDeliveryTime(); ns != 0 {
		entry.Date = time.Unix(0, ns).Format("2006-01-02 15:04:05 -0700")
	} else if ns := props.GetClientSubmitTime(); ns != 0 {
		entry.Date = time.Unix(0, ns).Format("2006-01-02 15:04:05 -0700")
	}

	atts, err := msg.GetAllAttachments()
	if err == nil {
		for i, att := range atts {
			name := att.GetAttachLongFilename()
			if name == "" {
				name = att.GetAttachFilename()
			}
			size := att.GetAttachSize()
			ao := attachmentOut{Name: name, Size: size}
			if tmpDir != "" && size > 0 && int64(size) <= maxBytes && extWhitelisted(name, whitelist) {
				tmpPath := filepath.Join(tmpDir, fmt.Sprintf("att_%d_%d_%s", msg.Identifier, i, sanitizeFilename(name)))
				f, ferr := os.Create(tmpPath)
				if ferr == nil {
					if _, werr := att.WriteTo(f); werr != nil {
						fmt.Fprintf(os.Stderr, "warn: attachment %s: %v\n", name, werr)
						os.Remove(tmpPath)
					} else {
						ao.Path = tmpPath
					}
					f.Close()
				} else {
					fmt.Fprintf(os.Stderr, "warn: create tmp attachment %s: %v\n", tmpPath, ferr)
				}
			}
			entry.Attach = append(entry.Attach, ao)
		}
	}

	return enc.Encode(&entry)
}
