export async function uploadImage(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'avatar');

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error('Upload failed:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
}
