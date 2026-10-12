import mammoth from 'mammoth'

export async function extraireTexteDocx(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer })
  return value.trim()
}
