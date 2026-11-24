#!/usr/bin/env python3
"""Quick profile of a CSV file: rows, columns, missing values, duplicates, and type and range per column.

Usage: python3 profile_csv.py <file.csv> [--delimiter ,|tab] [--encoding utf-8-sig] [--max-rows 200000]

Standard library only. Reads the file, never writes or sends anything.
"""
import argparse
import csv
import re
import sys
from collections import Counter
from datetime import datetime

LABELS = {
    "title": "Data profile",
    "rows": "Rows",
    "truncated": " (hit --max-rows; later rows were not counted)",
    "columns": "Columns",
    "duplicates": "Fully duplicated rows",
    "ragged": "Rows whose column count differs from the header",
    "table": [
        "Column",
        "Type",
        "Missing",
        "Missing %",
        "Distinct",
        "Summary"
    ],
    "number": "number",
    "date": "date",
    "text": "text",
    "top": "most common",
    "empty": "The file is empty.",
    "encoding": "Could not read the file: wrong encoding. Try --encoding gb18030 or --encoding utf-16.",
    "missing_file": "File not found; check the path.",
}

DATE_FORMATS = ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y", "%m/%d/%Y")
NUMBER = re.compile(r"^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$")
MISSING = {"", "na", "n/a", "null", "none", "nan", "-"}


def to_number(value):
    text = value.replace(",", "").strip()
    return float(text) if NUMBER.match(text) else None


def to_date(value):
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value.strip(), fmt)
        except ValueError:
            continue
    return None


def profile(path, delimiter, encoding, max_rows):
    with open(path, newline="", encoding=encoding) as handle:
        reader = csv.reader(handle, delimiter=delimiter)
        header = next(reader, None)
        if header is None:
            print(LABELS["empty"])
            return
        columns = [{"values": Counter(), "missing": 0, "numbers": [], "dates": []} for _ in header]
        seen_rows = Counter()
        rows = 0
        ragged = 0
        for row in reader:
            if rows >= max_rows:
                break
            rows += 1
            if len(row) != len(header):
                ragged += 1
            seen_rows[tuple(row)] += 1
            for index, column in enumerate(columns):
                value = row[index] if index < len(row) else ""
                if value.strip().lower() in MISSING:
                    column["missing"] += 1
                    continue
                if len(column["values"]) < 10000 or value in column["values"]:
                    column["values"][value] += 1
                number = to_number(value)
                if number is not None:
                    column["numbers"].append(number)
                elif len(column["dates"]) < 10000:
                    date = to_date(value)
                    if date is not None:
                        column["dates"].append(date)

    duplicates = sum(count - 1 for count in seen_rows.values() if count > 1)
    print(f"# {LABELS['title']}: {path}\n")
    print(f"- {LABELS['rows']}: {rows}{LABELS['truncated'] if rows >= max_rows else ''}")
    print(f"- {LABELS['columns']}: {len(header)}")
    print(f"- {LABELS['duplicates']}: {duplicates}")
    print(f"- {LABELS['ragged']}: {ragged}\n")
    print(f"| {' | '.join(LABELS['table'])} |")
    print(f"|{'---|' * len(LABELS['table'])}")
    for name, column in zip(header, columns):
        filled = rows - column["missing"]
        numbers, dates = column["numbers"], column["dates"]
        if filled and len(numbers) == filled:
            kind = LABELS["number"]
            mean = sum(numbers) / len(numbers)
            summary = f"min {min(numbers):g} / max {max(numbers):g} / mean {mean:.4g}"
        elif filled and len(dates) == filled:
            kind = LABELS["date"]
            summary = f"{min(dates):%Y-%m-%d} ~ {max(dates):%Y-%m-%d}"
        else:
            kind = LABELS["text"]
            top = ", ".join(f"{v[:20]}({c})" for v, c in column["values"].most_common(3))
            summary = f"{LABELS['top']}: {top}"
        missing_pct = f"{column['missing'] / rows:.1%}" if rows else "-"
        unique = len(column["values"])
        unique_text = f"{unique}+" if unique >= 10000 else str(unique)
        cells = [name or "(blank)", kind, str(column["missing"]), missing_pct, unique_text, summary]
        print("| " + " | ".join(cell.replace("|", "/") for cell in cells) + " |")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("path")
    parser.add_argument("--delimiter", default=",")
    parser.add_argument("--encoding", default="utf-8-sig")
    parser.add_argument("--max-rows", type=int, default=200000)
    args = parser.parse_args()
    # Shells pass "\t" through as two characters; accept it (and "tab") as a real tab.
    delimiter = "\t" if args.delimiter in ("\\t", "tab") else args.delimiter
    try:
        profile(args.path, delimiter, args.encoding, args.max_rows)
    except UnicodeDecodeError:
        sys.exit(LABELS["encoding"])
    except FileNotFoundError:
        sys.exit(LABELS["missing_file"])


if __name__ == "__main__":
    main()
