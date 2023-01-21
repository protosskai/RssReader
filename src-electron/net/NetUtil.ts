import {net} from 'electron'

export const getUrl = async (url: string): Promise<string | null> => {
  return new Promise<string>((resolve, reject) => {
    const request = net.request(url)
    request.on('response', (response) => {
      const buffer: Buffer[] = [];
      response.on('data', (data) => {
        buffer.push(data)
      })
      response.on('end', () => {
        const result = Buffer.concat(buffer).toString();
        resolve(result)
      })
    })
    request.end()
  })
}
