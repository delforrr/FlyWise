import { PerformanceInterceptor } from './performance.interceptor.js';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('PerformanceInterceptor', () => {
  let interceptor: PerformanceInterceptor;

  beforeEach(() => {
    interceptor = new PerformanceInterceptor();
  });

  it('does not set headers after a controller has sent the response', (done) => {
    const setHeader = jest.fn(() => {
      throw new Error('Headers already sent');
    });
    const context = {
      switchToHttp: () => ({
        getResponse: () => ({ headersSent: true, setHeader }),
        getRequest: () => ({ method: 'GET', url: '/api/salud' }),
      }),
    } as unknown as ExecutionContext;
    interceptor
      .intercept(context, { handle: () => of({ estado: 'ok' }) })
      .subscribe({
        error: done,
        complete: () => {
          expect(setHeader).not.toHaveBeenCalled();
          done();
        },
      });
  });

  it('should intercept request and set X-Response-Time header', (done) => {
    const mockSetHeader = jest.fn();
    const mockContext = {
      switchToHttp: () => ({
        getResponse: () => ({ setHeader: mockSetHeader }),
        getRequest: () => ({ method: 'GET', url: '/api/rutas/explorar' }),
      }),
    } as unknown as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (val) => {
        expect(val).toEqual({ success: true });
        expect(mockSetHeader).toHaveBeenCalledWith(
          'X-Response-Time',
          expect.stringMatching(/^\d+ms$/),
        );
      },
      complete: () => {
        done();
      },
    });
  });
});
