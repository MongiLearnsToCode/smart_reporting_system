## [Identity]

You are working in my Next.js + TypeScript app (CODEX). You already know this codebase: `app/page.tsx` holds the state and mutations, `@/components/composer.tsx` is the extracted input component, and styling is plain Tailwind utility classes with `lucide-react` icons — no shadcn/ui, no component library. Match that style. Don't introduce new UI dependencies.

## [Task]

Upgrade the composer to support four capabilities, modelled on patterns from the open-source app Zola (github.com/ibelick/zola, specifically `app/components/chat-input/`):

1. **Multi-file attachments.** Replace the single `previewFile: File | null` model with `files: File[]`. Multiple files can be attached at once, shown as a horizontal scrollable row of removable chips above the textarea.
2. **Drag-and-drop anywhere on screen.** Dragging a file over the window shows a full-viewport drop overlay. Dropping adds the file(s) to the attachment list.
3. **Paste an image from the clipboard.** Pasting into the textarea checks `clipboardData.items` for image MIME types and adds them as attached files, same path as drag-and-drop and the file picker button.
4. **Stop button while processing.** While `isProcessing` is true, the send button swaps to a stop icon. See the cancellation note in Constraints below — don't fake this.

This is a behaviour change, not just a visual one: read the "Important behaviour change" note in Context before writing any code.

## [Context]

**Current `composer.tsx`:**

```tsx
"use client";

import { useRef } from "react";
import { Send, Mic, FileUp } from "lucide-react";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  onMicClick?: () => void;
}

export function Composer({ value, onChange, onSubmit, onFileUpload, disabled, onMicClick }: ComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // ... textarea + toolbar with Mic / FileUp / Send, rounded-[28px] dark pill shell
}
```

**Current relevant state and handlers in `page.tsx`:**

```tsx
const [inputText, setInputText] = useState("");
const [isProcessing, setIsProcessing] = useState(false);
const [previewFile, setPreviewFile] = useState<File | null>(null);
const [showFilePreview, setShowFilePreview] = useState(false);

async function handleSubmit(e?: React.FormEvent) {
  if (e?.preventDefault) e.preventDefault();
  if (!inputText.trim()) return;
  setIsProcessing(true);
  processMutation.mutate({ rawContent: inputText, type: "text" });
}

async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = "";
  setPreviewFile(file);
  setIsProcessing(true);
  // reads file text if small + text-based, builds rawContent,
  // calls upload({ file }), then processMutation.mutate({ rawContent, type: "file", fileUrl })
}
```

**Important behaviour change:** today, choosing a file uploads and processes it immediately — attaching IS submitting. There's no staging step. Moving to chips (point 1) means files get *staged* and aren't uploaded/processed until the user hits send or presses Enter, same as Zola. That's the correct target behaviour here — just confirm in your summary that you made this change deliberately, since it's a real shift from how the log feed currently fills up per attached file.

**Zola's reference patterns** (interaction logic only — their stack is shadcn/ui + phosphor-icons + a context-provider primitive, ours isn't; port the behaviour, not their component architecture or visual language):

Window-level drag-and-drop with a counter (handles nested drag events correctly):
```tsx
const dragCounter = useRef(0);
useEffect(() => {
  const handleDragIn = (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer?.items.length) setIsDragging(true);
  };
  const handleDragOut = (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer?.files.length) handleFiles(e.dataTransfer.files);
  };
  window.addEventListener("dragenter", handleDragIn);
  window.addEventListener("dragleave", handleDragOut);
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", handleDrop);
  return () => { /* remove listeners */ };
}, []);
```

Paste-to-upload (filtered to images, builds a real `File` from the clipboard blob):
```tsx
const handlePaste = async (e: React.ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  const imageFiles: File[] = [];
  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) imageFiles.push(new File([file], `pasted-image-${Date.now()}.${file.type.split("/")[1]}`, { type: file.type }));
    }
  }
  if (imageFiles.length) onFilesAdded(imageFiles);
};
```

Unified entry point — file picker, drag-drop, and paste should all funnel into one `onFilesAdded(files: File[])` rather than three separate handlers.

## [Constraints]

- Do not change the visual shell of the composer: same `rounded-[28px]` dark pill, same `lucide-react` icons, no shadcn/ui or other component library added. The drop overlay and file chips are the only new visual elements, and they should look like they belong in this design, not borrowed wholesale from Zola's lighter shadcn theme.
- `onFileUpload`'s signature has to change from `(e: ChangeEvent<HTMLInputElement>) => void` to something like `(files: File[]) => void` so the file input, drop handler, and paste handler can all call the same function. Update the call sites in `page.tsx` accordingly.
- On the stop button: check whether `processMutation` (TanStack Query) actually supports cancellation. If the mutation function doesn't thread an `AbortController` through to the underlying request, a "stop" click can't truly cancel in-flight AI processing — it can only hide the spinner and let the response land silently. If that's the case, implement the visual swap but say so plainly in your summary. Don't make it look like real cancellation if it isn't.
- Keep the existing per-file upload pipeline (`upload({ file })` → build `rawContent` → `processMutation.mutate(...)`) for the actual upload/processing logic. Multiple attached files at send time should reuse this per file, not get rewritten into something new.
- TypeScript strict, no `any`.

## [Output Format]

1. Updated `composer.tsx` (or split into `composer.tsx` + `file-list.tsx`/`file-item.tsx` if that keeps it readable — your call, mirror that split only if it actually helps).
2. Updated relevant sections of `page.tsx` (state, handlers, the `<Composer />` call site).
3. A short summary covering: how multi-file staging now works, what triggers the drop overlay, and the honest answer on whether stop actually cancels in-flight processing or just hides the UI.
