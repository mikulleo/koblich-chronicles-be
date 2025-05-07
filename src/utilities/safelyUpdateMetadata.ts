// src/utilities/safelyUpdateMetadata.ts
export function safelyUpdateMetadata(existingMetadata: any | null | undefined, newData: any) {
  if (!existingMetadata || typeof existingMetadata !== 'object') {
    return { ...newData }
  }

  return { ...existingMetadata, ...newData }
}
