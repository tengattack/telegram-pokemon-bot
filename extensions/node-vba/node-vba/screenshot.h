
#ifndef SCREENSHOT_H
#define SCREENSHOT_H

#pragma once

#include <stdint.h>
#include <Windows.h>

int window_screenshot(HWND hWnd, unsigned char **buf, size_t *buf_len);

#endif