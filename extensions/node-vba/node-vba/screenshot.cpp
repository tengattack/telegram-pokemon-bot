
#include <atlimage.h>
#include "screenshot.h"

size_t get_png_size(CImage *image)
{
	HGLOBAL	hMem = ::GlobalAlloc(GMEM_MOVEABLE, 0);
	if (!hMem) {
		return 0;
	}

	IStream* pstm = NULL;
	HRESULT hr = ::CreateStreamOnHGlobal(hMem, TRUE, &pstm);
	if (FAILED(hr)) {
		GlobalFree(hMem);
		return 0;
	}
	hr = image->Save(pstm, Gdiplus::ImageFormatPNG);
	if (FAILED(hr)) {
		pstm->Release();
		GlobalFree(hMem);
		return 0;
	}

	ULARGE_INTEGER liSize;
	IStream_Size(pstm, &liSize);
	if (liSize.HighPart > 0) {
		return 0;
	}

	pstm->Release();
	GlobalFree(hMem);
	return liSize.LowPart;
}

int window_screenshot(HWND hWnd, unsigned char **buf, size_t *buf_len)
{
	RECT rc = {0}, rcClient;
	// 获取设备相关信息的尺寸大小
	GetWindowRect(hWnd, &rc);
	GetClientRect(hWnd, &rcClient);

	HDC dc = GetDC(NULL); // 要截图的窗口句柄，为空则全屏
	if (dc == NULL) {
		return -1;
	}

	int width = rcClient.right - rcClient.left, height = rcClient.bottom - rcClient.top;
	int sidebar = ((rc.right - rc.left - width) / 2);
	int xpos = rc.left + sidebar,
		ypos = rc.top + (rc.bottom - rc.top - height - sidebar);

	//printf("%d %d %d %d\n", xpos, ypos, rc.left, rc.top);

	int nBitPerPixel = GetDeviceCaps(dc, BITSPIXEL);
	CImage *image = new CImage();
	// 创建图像，设置宽高，像素
	image->Create(width, height, nBitPerPixel);
	// 对指定的源设备环境区域中的像素进行位块（bit_block）转换
	BitBlt(
		image->GetDC(),  // 保存到的目标 图片对象 上下文
		0, 0,           // 起始 x, y 坐标
		width, height,  // 截图宽高
		dc,             // 截取对象的 上下文句柄
		xpos, ypos,     // 指定源矩形区域左上角的 X, y 逻辑坐标
		SRCCOPY);

	// 释放 DC句柄
	ReleaseDC(hWnd, dc);
	// 释放图片上下文
	image->ReleaseDC();
	// 保存图片

	//size_t img_size = get_png_size(image);
	HGLOBAL	hMem = ::GlobalAlloc(GMEM_MOVEABLE, 0);
	if (!hMem) {
		delete image;
		return -2;
	}

	IStream* pstm = NULL;
	HRESULT hr = ::CreateStreamOnHGlobal(hMem, TRUE, &pstm);
	if (FAILED(hr)) {
		delete image;
		GlobalFree(hMem);
		return hr;
	}
	hr = image->Save(pstm, Gdiplus::ImageFormatPNG);
	if (FAILED(hr)) {
		pstm->Release();
		delete image;
		GlobalFree(hMem);
		return hr;
	}

	ULARGE_INTEGER liSize;
	IStream_Size(pstm, &liSize);
	if (liSize.HighPart > 0) {
		// too large
		pstm->Release();
		delete image;
		GlobalFree(hMem);
		return 1;
	}

	IStream_Reset(pstm);

	unsigned char *nbuf = (unsigned char *)malloc(liSize.LowPart);
	IStream_Read(pstm, nbuf, liSize.LowPart);
	/*unsigned char *mem = (unsigned char *)GlobalLock(hMem);
	memcpy(nbuf, mem, liSize.LowPart);
	GlobalUnlock(hMem);*/

	*buf = nbuf;
	*buf_len = liSize.LowPart;
	//image->Save(L"D:\\ScreenShot32.png", Gdiplus::ImageFormatPNG);

	//*pimg = image;
	pstm->Release();
	delete image;
	GlobalFree(hMem);
	return 0;
}