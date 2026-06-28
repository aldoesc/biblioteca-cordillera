// Redimensiona y comprime una imagen en el navegador antes de subirla.
// Las fotos de celular suelen pesar varios MB; acá las bajamos a un tamaño
// razonable (máx. 1400px de lado, JPEG ~82%). Gratis, sin servicios externos.
export async function resizeImage(file: File, maxSize = 1400, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    // Si ya es chica y liviana, no la tocamos.
    if (Math.max(width, height) <= maxSize && file.size < 350_000) {
      bitmap.close?.();
      return file;
    }

    const scale = Math.min(1, maxSize / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    // Fondo blanco (por si el original era PNG con transparencia → JPEG).
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    // Usamos el resultado solo si efectivamente quedó más liviano.
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // ante cualquier error, subimos el original
  }
}
