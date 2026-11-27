import { useState, type CSSProperties, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export const bizImageUrl = (path: string) => supabase!.storage.from("business-images").getPublicUrl(path).data.publicUrl;
export const swapExt = (path: string) => path.replace(/\.(png|jpg)$/i, match => (match.toLowerCase() === ".png" ? ".jpg" : ".png"));

/** A business picture. Tries the saved name, then the same name with the other extension, then shows the fallback. */
export function BizImg({ path, style, fallback, top }: { path: string; style?: CSSProperties; fallback?: ReactNode; top?: boolean }) {
  const [tries, setTries] = useState(0);
  if (tries >= 2) return <>{fallback ?? null}</>;
  return <img src={bizImageUrl(tries === 0 ? path : swapExt(path))} alt="" loading="lazy" onError={() => setTries(count => count + 1)} style={{ objectFit: "cover", objectPosition: top ? "top" : "center", ...style }} />;
}

/** Shrinks a photo before upload so it loads fast on mobile data. */
export async function shrinkImage(file: File, max = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not read that photo")), "image/jpeg", 0.85));
}
