import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

/**
 * <doclens-icon name="search"> —— 统一线性图标组件。
 *
 * 用 Lucide 静态 SVG（24×24 描边，stroke=currentColor），通过 unsafeSVG 注入。
 * 颜色继承自上下文 currentColor；尺寸跟随 1em（即宿主 font-size），
 *   故消费方设 font-size 即可控制大小（如 .icon { font-size: 18px }）。
 *
 * 用法：
 *   <doclens-icon name="search"></doclens-icon>
 *   <doclens-icon name="folder" style="font-size:20px"></doclens-icon>
 */
import searchIcon from "lucide-static/icons/search.svg?raw";
import folderIcon from "lucide-static/icons/folder.svg?raw";
import folderOpenIcon from "lucide-static/icons/folder-open.svg?raw";
import fileIcon from "lucide-static/icons/file.svg?raw";
import messageCircleIcon from "lucide-static/icons/message-circle.svg?raw";
import uploadIcon from "lucide-static/icons/upload.svg?raw";
import downloadIcon from "lucide-static/icons/download.svg?raw";
import folderPlusIcon from "lucide-static/icons/folder-plus.svg?raw";
import pencilIcon from "lucide-static/icons/pencil.svg?raw";
import arrowRightIcon from "lucide-static/icons/arrow-right.svg?raw";
import trash2Icon from "lucide-static/icons/trash-2.svg?raw";
import saveIcon from "lucide-static/icons/save.svg?raw";
import xIcon from "lucide-static/icons/x.svg?raw";
import maximize2Icon from "lucide-static/icons/maximize-2.svg?raw";
import copyIcon from "lucide-static/icons/copy.svg?raw";
import arrowLeftIcon from "lucide-static/icons/arrow-left.svg?raw";
import arrowUpIcon from "lucide-static/icons/arrow-up.svg?raw";
import arrowUpToLineIcon from "lucide-static/icons/arrow-up-to-line.svg?raw";
import arrowDownToLineIcon from "lucide-static/icons/arrow-down-to-line.svg?raw";
import moreHorizontalIcon from "lucide-static/icons/more-horizontal.svg?raw";
import moreVerticalIcon from "lucide-static/icons/more-vertical.svg?raw";
import chevronDownIcon from "lucide-static/icons/chevron-down.svg?raw";
import chevronRightIcon from "lucide-static/icons/chevron-right.svg?raw";
import refreshCwIcon from "lucide-static/icons/refresh-cw.svg?raw";
import refreshCcwIcon from "lucide-static/icons/refresh-ccw.svg?raw";
import alertTriangleIcon from "lucide-static/icons/alert-triangle.svg?raw";
import checkIcon from "lucide-static/icons/check.svg?raw";
import clipboardIcon from "lucide-static/icons/clipboard.svg?raw";
import brainIcon from "lucide-static/icons/brain.svg?raw";
import settingsIcon from "lucide-static/icons/settings.svg?raw";
import globeIcon from "lucide-static/icons/globe.svg?raw";
import scaleIcon from "lucide-static/icons/scale.svg?raw";
import bookOpenIcon from "lucide-static/icons/book-open.svg?raw";
import rotateCcwIcon from "lucide-static/icons/rotate-ccw.svg?raw";
import sparklesIcon from "lucide-static/icons/sparkles.svg?raw";
import regexIcon from "lucide-static/icons/regex.svg?raw";
import cameraIcon from "lucide-static/icons/camera.svg?raw";
import imageIcon from "lucide-static/icons/image.svg?raw";
import calendarIcon from "lucide-static/icons/calendar.svg?raw";
import chevronLeftIcon from "lucide-static/icons/chevron-left.svg?raw";

const ICONS: Record<string, string> = {
  search: searchIcon,
  folder: folderIcon,
  "folder-open": folderOpenIcon,
  file: fileIcon,
  "message-circle": messageCircleIcon,
  upload: uploadIcon,
  download: downloadIcon,
  "folder-plus": folderPlusIcon,
  pencil: pencilIcon,
  "arrow-right": arrowRightIcon,
  "trash-2": trash2Icon,
  save: saveIcon,
  x: xIcon,
  "arrow-left": arrowLeftIcon,
  "arrow-up": arrowUpIcon,
  "arrow-up-to-line": arrowUpToLineIcon,
  "arrow-down-to-line": arrowDownToLineIcon,
  "more-horizontal": moreHorizontalIcon,
  "more-vertical": moreVerticalIcon,
  "chevron-down": chevronDownIcon,
  "chevron-right": chevronRightIcon,
  "refresh-cw": refreshCwIcon,
  "refresh-ccw": refreshCcwIcon,
  "alert-triangle": alertTriangleIcon,
  check: checkIcon,
  clipboard: clipboardIcon,
  brain: brainIcon,
  settings: settingsIcon,
  globe: globeIcon,
  scale: scaleIcon,
  "book-open": bookOpenIcon,
  "rotate-ccw": rotateCcwIcon,
  sparkles: sparklesIcon,
  regex: regexIcon,
  camera: cameraIcon,
  image: imageIcon,
  calendar: calendarIcon,
  "chevron-left": chevronLeftIcon,
  "maximize-2": maximize2Icon,
  copy: copyIcon,
};

@customElement("doclens-icon")
export class DoclensIcon extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      vertical-align: middle;
      /* 尺寸跟随宿主 font-size：svg 用 1em */
    }
    :host svg {
      width: 1em;
      height: 1em;
      display: block;
    }
    /* .filled：描边图标变实心填充（fill/stroke 都用 currentColor，颜色继承上下文） */
    :host(.filled) svg {
      fill: currentColor;
      stroke: currentColor;
    }
    /* .thick：加粗描边线条 */
    :host(.thick) svg {
      stroke-width: 2.6;
    }
  `;

  /** 图标名（见 ICONS 表）；未知名渲染空。 */
  @property() name = "";

  render() {
    const svg = ICONS[this.name];
    return svg ? html`${unsafeSVG(svg)}` : null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "doclens-icon": DoclensIcon;
  }
}
