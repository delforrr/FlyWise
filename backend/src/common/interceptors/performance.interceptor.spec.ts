import { PerformanceInterceptor } from './performance.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('PerformanceInterceptor', () => {
  let interceptor: PerformanceInterceptor;

  beforeEach(() => {
    interceptor = new PerformanceInterceptor();
  });

  it('should intercept request and set X-Response-Time header', (done) => {
    const mockSetHeader = jest.fn();
    const mockContext = {
      switchToHttp: () => ({
        getResponse: () => ({ setHeader: mockSetHeader }),
        getRequest: () => ({ method: 'GET', url: '/api/routes/explore' }),
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
