import { describe, expect, it } from 'vitest'
import { FileService, type FileInfo } from '../../src/FileService'

const FIXTURES = `${__dirname}/../fixtures`

function listFiles(dir: string): FileInfo[] {
  const files = new FileService().listFiles(`${FIXTURES}/${dir}`)
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

describe('FileService', () => {
  it('should add charset to text types only', () => {
    expect(listFiles('test-charset')).toEqual([
      { relativePath: 'app.js', contentType: 'text/javascript; charset=utf-8' },
      { relativePath: 'desktop.png', contentType: 'image/png' },
      { relativePath: 'index.html', contentType: 'text/html; charset=utf-8' },
      { relativePath: 'openapi.json', contentType: 'application/json' },
      { relativePath: 'styles.css', contentType: 'text/css; charset=utf-8' },
    ])
  })

  it('should list files of nested dirs, not the dirs', () => {
    expect(listFiles('nested').map(f => f.relativePath)).toEqual([
      'assets/index.js',
      'assets/index.js.map',
      'index.html',
      'robots.txt',
    ])
  })

  it('should leave content type undefined for unknown extension', () => {
    expect(listFiles('no-extension')).toEqual([{ relativePath: 'file', contentType: undefined }])
  })

  it('should detect binary types', () => {
    expect(listFiles('binary-files')).toEqual([{ relativePath: 'helloworld.jar', contentType: 'application/java-archive' }])
  })

  it('should fail if dir is a file', () => {
    expect(() => listFiles('test-file')).toThrow('ENOTDIR')
  })

  it('should read file content', () => {
    const content = new FileService().readFile(`${FIXTURES}/happy-path/test.txt`)
    expect(content.length).toBeGreaterThan(0)
  })
})
