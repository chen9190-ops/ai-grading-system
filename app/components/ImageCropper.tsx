"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactCropper, { ReactCropperElement } from "react-cropper";

type ImageCropperProps = {
  imageSrc: string;
  fileName: string;
  inputId: string;
  onCancel: () => void;
  onConfirm: (file: File, previewUrl: string) => void;
};
type CropperInstance = ReactCropperElement["cropper"];
type CropData = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function ImageCropper({
  imageSrc,
  fileName,
  inputId,
  onCancel,
  onConfirm,
}: ImageCropperProps) {
  const cropperRef = useRef<ReactCropperElement>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [cropError, setCropError] = useState("");

  async function handleReady() {
    const cropper = cropperRef.current?.cropper;

    if (!cropper) {
      return;
    }

    await initializeCropBox(cropper, imageSrc);
    setIsReady(true);
  }

  const handleConfirm = useCallback(async () => {
    const cropper = cropperRef.current?.cropper;

    if (!cropper || isCropping || !isReady) {
      return;
    }

    setIsCropping(true);
    setCropError("");

    try {
      const canvas = cropper.getCroppedCanvas({
        maxWidth: 2400,
        maxHeight: 2400,
        fillColor: "#ffffff",
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
      });

      const blob = await getCanvasBlob(canvas);
      const file = new File([blob], createCroppedFileName(fileName), {
        type: "image/jpeg",
      });
      const previewUrl = canvas.toDataURL("image/jpeg", 0.92);

      onConfirm(file, previewUrl);
    } catch (error) {
      console.error("Image crop failed", error);
      setCropError("裁剪图片生成失败，请重新调整裁剪框后再试。");
    } finally {
      setIsCropping(false);
    }
  }, [fileName, isCropping, isReady, onConfirm]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter") {
        event.preventDefault();
        void handleConfirm();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleConfirm, onCancel]);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2545]/70 p-1.5 backdrop-blur-sm sm:p-5"
      role="dialog"
    >
      <div className="flex h-[calc(100dvh-0.75rem)] max-h-[900px] w-[calc(100vw-0.75rem)] max-w-[960px] min-w-0 flex-col overflow-hidden border border-[#D8DEE8] bg-white shadow-2xl sm:h-[min(88dvh,900px)] sm:w-[min(94vw,960px)]">
        <div className="shrink-0 border-b-4 border-[#0B4EA2] bg-[#163A70] px-3 py-2.5 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white">裁剪图片区域</h2>
              <p className="mt-1 truncate text-xs text-blue-100">{fileName}</p>
            </div>
            <p className="hidden text-xs leading-5 text-blue-100 sm:block">
              拖动图片移动画面，滚轮缩放；拖动裁剪框边线或四角调整范围。
            </p>
          </div>
        </div>

        <div className="cropper-shell min-h-0 flex-1 touch-none bg-slate-950">
          <ReactCropper
            key={imageSrc}
            ref={cropperRef}
            src={imageSrc}
            className="h-full w-full"
            viewMode={1}
            dragMode="move"
            aspectRatio={NaN}
            autoCrop
            autoCropArea={0.8}
            background={false}
            guides
            center
            highlight={false}
            responsive
            restore={false}
            checkOrientation
            movable
            zoomable
            zoomOnWheel
            wheelZoomRatio={0.12}
            scalable
            cropBoxMovable
            cropBoxResizable
            minCropBoxWidth={48}
            minCropBoxHeight={48}
            toggleDragModeOnDblclick={false}
            ready={handleReady}
          />
        </div>

        <div className="shrink-0 border-t border-[#D8DEE8] bg-[#F5F7FA] px-2.5 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:py-3">
          <div className="mb-2 border border-[#D8DEE8] bg-white px-2 py-1.5 text-[11px] leading-4 text-[#163A70] sm:mb-3 sm:px-3 sm:py-2 sm:text-xs sm:leading-5">
            请只框选学生自己的答案区域，不要包含标准答案、题干解析或其他题目内容。
          </div>
          {cropError ? <p className="mb-2 text-xs font-medium text-red-600" role="alert">{cropError}</p> : null}
          <div className="grid grid-cols-[.8fr_1fr_1.2fr] gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-11 border border-[#D8DEE8] bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              取消
            </button>
            <label
              htmlFor={inputId}
              className="flex h-11 cursor-pointer items-center justify-center border border-[#D8DEE8] bg-white text-sm font-semibold text-[#163A70] transition hover:bg-[#F0F5FB]"
            >
              重新选择
            </label>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isCropping || !isReady}
              className="h-11 bg-[#0B4EA2] text-sm font-semibold text-white shadow-sm transition hover:bg-[#163A70] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
            >
              {isCropping ? "裁剪中..." : isReady ? "确认裁剪" : "图片加载中"}
            </button>
          </div>
          <p className="mt-2 hidden text-center text-[11px] leading-4 text-slate-500 sm:block">
            Enter 确认裁剪，Esc 取消裁剪
          </p>
        </div>
      </div>
    </div>
  );
}

function getCanvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("裁剪图片生成失败"));
        }
      },
      "image/jpeg",
      0.92,
    );
  });
}

async function initializeCropBox(cropper: CropperInstance, imageSrc: string) {
  const imageData = cropper.getImageData();
  const imageWidth = imageData.naturalWidth;
  const imageHeight = imageData.naturalHeight;
  let detectedPaperCrop: CropData | null = null;

  try {
    detectedPaperCrop = await detectPaperCrop(imageSrc);
  } catch {
    detectedPaperCrop = null;
  }

  const nextCrop =
    detectedPaperCrop ?? getSmartFallbackCrop(imageWidth, imageHeight);

  cropper.setData(ensureMinimumCrop(nextCrop, imageWidth, imageHeight));
}

async function detectPaperCrop(imageSrc: string): Promise<CropData | null> {
  const image = await loadImage(imageSrc);
  const maxAnalysisSize = 700;
  const scale = Math.min(
    1,
    maxAnalysisSize / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  const columnCounts = new Uint16Array(width);
  const rowCounts = new Uint16Array(height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const maxChannel = Math.max(red, green, blue);
      const minChannel = Math.min(red, green, blue);
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
      const saturation = maxChannel - minChannel;
      const looksLikePaper =
        (luminance > 168 && saturation < 82) || luminance > 215;

      if (looksLikePaper) {
        columnCounts[x] += 1;
        rowCounts[y] += 1;
      }
    }
  }

  const left = findFirstStrongIndex(columnCounts, height * 0.08);
  const right = findLastStrongIndex(columnCounts, height * 0.08);
  const top = findFirstStrongIndex(rowCounts, width * 0.08);
  const bottom = findLastStrongIndex(rowCounts, width * 0.08);

  if (left === -1 || right === -1 || top === -1 || bottom === -1) {
    return null;
  }

  const detectedWidth = right - left + 1;
  const detectedHeight = bottom - top + 1;
  const imageArea = width * height;
  const detectedArea = detectedWidth * detectedHeight;
  const hasMeaningfulSize =
    detectedArea > imageArea * 0.18 &&
    detectedWidth > width * 0.35 &&
    detectedHeight > height * 0.35;
  const hasVisibleBoundary =
    detectedWidth < width * 0.98 || detectedHeight < height * 0.98;

  if (!hasMeaningfulSize || !hasVisibleBoundary) {
    return null;
  }

  const paddingX = detectedWidth * 0.02;
  const paddingY = detectedHeight * 0.02;
  const scaledLeft = Math.max(0, left - paddingX) / scale;
  const scaledTop = Math.max(0, top - paddingY) / scale;
  const scaledRight = Math.min(width, right + paddingX) / scale;
  const scaledBottom = Math.min(height, bottom + paddingY) / scale;

  return {
    x: scaledLeft,
    y: scaledTop,
    width: scaledRight - scaledLeft,
    height: scaledBottom - scaledTop,
  };
}

function getSmartFallbackCrop(imageWidth: number, imageHeight: number): CropData {
  const isPortraitPhoneShot = imageHeight / imageWidth > 1.2;
  const cropWidth = imageWidth * (isPortraitPhoneShot ? 0.92 : 0.9);
  const cropHeight = imageHeight * (isPortraitPhoneShot ? 0.95 : 0.85);

  return {
    x: (imageWidth - cropWidth) / 2,
    y: (imageHeight - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

function ensureMinimumCrop(
  crop: CropData,
  imageWidth: number,
  imageHeight: number,
): CropData {
  const width = Math.min(imageWidth, Math.max(100, crop.width));
  const height = Math.min(imageHeight, Math.max(100, crop.height));
  const x = Math.min(Math.max(0, crop.x), Math.max(0, imageWidth - width));
  const y = Math.min(Math.max(0, crop.y), Math.max(0, imageHeight - height));

  return { x, y, width, height };
}

function findFirstStrongIndex(counts: Uint16Array, threshold: number) {
  for (let index = 0; index < counts.length; index += 1) {
    if (counts[index] >= threshold) {
      return index;
    }
  }

  return -1;
}

function findLastStrongIndex(counts: Uint16Array, threshold: number) {
  for (let index = counts.length - 1; index >= 0; index -= 1) {
    if (counts[index] >= threshold) {
      return index;
    }
  }

  return -1;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = src;
  });
}

function createCroppedFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;

  return `${baseName}-cropped.jpg`;
}
