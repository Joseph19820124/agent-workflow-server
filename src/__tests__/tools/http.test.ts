/**
 * HTTP Tools Tests
 */

import * as httpTool from '../../tools/http';

describe('HTTP Tools', () => {
  describe('get', () => {
    it('should return HTTP response with correct structure', async () => {
      const result = await httpTool.get({
        url: 'https://api.example.com/data',
      });

      expect(result).toHaveProperty('status', 200);
      expect(result).toHaveProperty('statusText', 'OK');
      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('url', 'https://api.example.com/data');
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
    });

    it('should accept custom headers', async () => {
      const result = await httpTool.get({
        url: 'https://api.example.com/data',
        headers: { Authorization: 'Bearer token' },
      });

      expect(result).toHaveProperty('status');
    });
  });

  describe('post', () => {
    it('should return HTTP response for POST request', async () => {
      const result = await httpTool.post({
        url: 'https://api.example.com/items',
        body: { name: 'test', value: 123 },
      });

      expect(result).toHaveProperty('status', 201);
      expect(result).toHaveProperty('statusText', 'Created');
      expect(result).toHaveProperty('data');
    });

    it('should work without body', async () => {
      const result = await httpTool.post({
        url: 'https://api.example.com/trigger',
      });

      expect(result).toHaveProperty('status');
    });
  });

  describe('put', () => {
    it('should return HTTP response for PUT request', async () => {
      const result = await httpTool.put({
        url: 'https://api.example.com/items/1',
        body: { name: 'updated' },
      });

      expect(result).toHaveProperty('status', 200);
      expect(result).toHaveProperty('data');
    });
  });

  describe('del (delete)', () => {
    it('should return HTTP response for DELETE request', async () => {
      const result = await httpTool.del({
        url: 'https://api.example.com/items/1',
      });

      expect(result).toHaveProperty('status', 204);
      expect(result).toHaveProperty('statusText', 'No Content');
    });
  });

  describe('patch', () => {
    it('should return HTTP response for PATCH request', async () => {
      const result = await httpTool.patch({
        url: 'https://api.example.com/items/1',
        body: { name: 'patched' },
      });

      expect(result).toHaveProperty('status', 200);
      expect(result).toHaveProperty('data');
    });
  });

  describe('URL validation', () => {
    it('should reject invalid URLs', async () => {
      await expect(
        httpTool.get({ url: 'not-a-valid-url' })
      ).rejects.toThrow('Invalid URL');
    });

    it('should accept valid HTTP URLs', async () => {
      const result = await httpTool.get({
        url: 'http://example.com/api',
      });
      expect(result).toHaveProperty('status');
    });

    it('should accept valid HTTPS URLs', async () => {
      const result = await httpTool.get({
        url: 'https://example.com/api',
      });
      expect(result).toHaveProperty('status');
    });
  });

  describe('helper functions', () => {
    describe('isSuccess', () => {
      it('should return true for 2xx status', () => {
        expect(httpTool.isSuccess({ status: 200 } as httpTool.HttpResponse)).toBe(true);
        expect(httpTool.isSuccess({ status: 201 } as httpTool.HttpResponse)).toBe(true);
        expect(httpTool.isSuccess({ status: 299 } as httpTool.HttpResponse)).toBe(true);
      });

      it('should return false for non-2xx status', () => {
        expect(httpTool.isSuccess({ status: 400 } as httpTool.HttpResponse)).toBe(false);
        expect(httpTool.isSuccess({ status: 500 } as httpTool.HttpResponse)).toBe(false);
      });
    });

    describe('isClientError', () => {
      it('should return true for 4xx status', () => {
        expect(httpTool.isClientError({ status: 400 } as httpTool.HttpResponse)).toBe(true);
        expect(httpTool.isClientError({ status: 404 } as httpTool.HttpResponse)).toBe(true);
        expect(httpTool.isClientError({ status: 499 } as httpTool.HttpResponse)).toBe(true);
      });

      it('should return false for non-4xx status', () => {
        expect(httpTool.isClientError({ status: 200 } as httpTool.HttpResponse)).toBe(false);
        expect(httpTool.isClientError({ status: 500 } as httpTool.HttpResponse)).toBe(false);
      });
    });

    describe('isServerError', () => {
      it('should return true for 5xx status', () => {
        expect(httpTool.isServerError({ status: 500 } as httpTool.HttpResponse)).toBe(true);
        expect(httpTool.isServerError({ status: 503 } as httpTool.HttpResponse)).toBe(true);
        expect(httpTool.isServerError({ status: 599 } as httpTool.HttpResponse)).toBe(true);
      });

      it('should return false for non-5xx status', () => {
        expect(httpTool.isServerError({ status: 200 } as httpTool.HttpResponse)).toBe(false);
        expect(httpTool.isServerError({ status: 400 } as httpTool.HttpResponse)).toBe(false);
      });
    });
  });
});
