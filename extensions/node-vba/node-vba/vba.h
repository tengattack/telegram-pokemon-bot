
#ifndef VBA_H
#define VBA_H

#pragma once

#include <winsock2.h>
#include <stdint.h>
#include <Windows.h>

#include <node/uv.h>
#include <node/node.h>
#include <node/node_buffer.h>
#include <node/node_object_wrap.h>

class VBAEmulator : public node::ObjectWrap {

public:
	static void Init(v8::Handle<v8::Object> exports);

	VBAEmulator();
	~VBAEmulator();

private:
	typedef struct _vba_t {
		~_vba_t() {
			cb.Reset();
		}

		HWND hWnd;
		int error;
		v8::Persistent<v8::Function> cb;

		unsigned char* buf_ptr;
		size_t buf_len;
		VBAEmulator *vba;
	} vba_t;

	static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void ScreenShot(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void ButtonStart(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void ButtonSelect(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void ButtonA(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void ButtonB(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void ButtonL(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void ButtonR(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void ButtonUp(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void ButtonDown(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void ButtonLeft(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void ButtonRight(const v8::FunctionCallbackInfo<v8::Value>& args);
	static v8::Persistent<v8::Function> constructor;


	static void EIO_ScreenShot(uv_work_t *req);
	static void EIO_AfterScreenShot(uv_work_t *req, int status);

protected:
	HWND m_hWnd;

public:
	void getWnd();
	void setForeground();

	void button_a();
	void button_b();
	void button_l();
	void button_r();
	void button_up();
	void button_down();
	void button_left();
	void button_right();
	void button_start();
	void button_select();
};

#endif