/**
 * File System Tools Tests
 */

import * as fsTool from '../../tools/fs';

describe('File System Tools', () => {
  describe('readFile', () => {
    it('should return file content with metadata', async () => {
      const result = await fsTool.readFile({
        path: 'test/file.ts',
      });

      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('encoding', 'utf8');
      expect(typeof result.content).toBe('string');
    });

    it('should accept custom encoding', async () => {
      const result = await fsTool.readFile({
        path: 'test/file.ts',
        encoding: 'ascii',
      });

      expect(result).toHaveProperty('encoding', 'ascii');
    });
  });

  describe('writeFile', () => {
    it('should return success result with size', async () => {
      const content = 'const test = true;';
      const result = await fsTool.writeFile({
        path: 'test/output.ts',
        content,
      });

      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('size', content.length);
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('listDirectory', () => {
    it('should return array of directory entries', async () => {
      const result = await fsTool.listDirectory({
        path: 'src',
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const entry = result[0];
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('path');
      expect(entry).toHaveProperty('type');
      expect(entry).toHaveProperty('size');
      expect(entry).toHaveProperty('modified');
      expect(['file', 'directory', 'symlink']).toContain(entry.type);
    });

    it('should accept recursive option', async () => {
      const result = await fsTool.listDirectory({
        path: 'src',
        recursive: true,
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return boolean', async () => {
      const result = await fsTool.exists({
        path: 'test/file.ts',
      });

      expect(typeof result).toBe('boolean');
    });
  });

  describe('deleteFile', () => {
    it('should return success status', async () => {
      const result = await fsTool.deleteFile({
        path: 'test/to-delete.ts',
      });

      expect(result).toHaveProperty('success', true);
    });
  });

  describe('createDirectory', () => {
    it('should return success with path', async () => {
      const result = await fsTool.createDirectory({
        path: 'test/new-dir',
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('path');
    });

    it('should accept recursive option', async () => {
      const result = await fsTool.createDirectory({
        path: 'test/nested/new-dir',
        recursive: true,
      });

      expect(result).toHaveProperty('success', true);
    });
  });

  describe('path security', () => {
    it('should prevent path traversal attacks', async () => {
      await expect(
        fsTool.readFile({ path: '../../../etc/passwd' })
      ).rejects.toThrow('Path traversal detected');
    });
  });
});
