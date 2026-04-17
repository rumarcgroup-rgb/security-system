import { useEffect, useRef, useState } from "react";

export function useEmployeeSignaturePad(activeDocument) {
  const signatureCanvasRef = useRef(null);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [hasSignatureDrawing, setHasSignatureDrawing] = useState(false);

  useEffect(() => {
    if (!activeDocument || activeDocument.document_type !== "Signature") return;

    window.setTimeout(() => {
      const canvas = signatureCanvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.beginPath();
    }, 0);
  }, [activeDocument]);

  function clearSignaturePad() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      setHasSignatureDrawing(false);
      return;
    }

    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    setHasSignatureDrawing(false);
  }

  function startSignatureStroke(event) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches?.[0]?.clientX ?? event.clientX;
    const clientY = event.touches?.[0]?.clientY ?? event.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
    context.beginPath();
    context.moveTo(x, y);

    setIsDrawingSignature(true);
    setHasSignatureDrawing(true);
  }

  function drawSignatureStroke(event) {
    if (!isDrawingSignature) return;

    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches?.[0]?.clientX ?? event.clientX;
    const clientY = event.touches?.[0]?.clientY ?? event.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    context.lineTo(x, y);
    context.stroke();
  }

  function endSignatureStroke() {
    if (!isDrawingSignature) return;
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    context?.beginPath();
    setIsDrawingSignature(false);
  }

  return {
    clearSignaturePad,
    drawSignatureStroke,
    endSignatureStroke,
    hasSignatureDrawing,
    signatureCanvasRef,
    startSignatureStroke,
  };
}
