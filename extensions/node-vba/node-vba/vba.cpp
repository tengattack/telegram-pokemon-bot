
#include <node/node.h>
#include "vba.h"
#include "screenshot.h"

#define KEY_WAIT 250
#define S_SendInput(cInputs, pInputs, cbSize) { SendInput(cInputs, pInputs, cbSize); Sleep(KEY_WAIT); }

using namespace v8;

Persistent<Function> VBAEmulator::constructor;

// default undefined
#define CLASS_MAP_KEY(key, func) \
void VBAEmulator::##func(const v8::FunctionCallbackInfo<v8::Value>& args) \
{\
	Isolate* isolate = args.GetIsolate();\
	EscapableHandleScope scope(isolate);\
	Local<Value> result;\
	VBAEmulator* vba = ObjectWrap::Unwrap<VBAEmulator>(args.Holder());\
	vba->setForeground();\
	vba->button_##key();\
	args.GetReturnValue().SetUndefined();\
}

void key_press(HWND hWnd, int vk)
{
	/*auto bRet = PostMessage(hWnd, WM_KEYDOWN, vk, MapVirtualKey(vk, 0) << 16);
	if (!bRet) {
		return;
	}
	Sleep(KEY_WAIT);

	bRet = PostMessage(hWnd, WM_KEYUP, vk, MapVirtualKey(vk, 0) << 16);
	if (!bRet) {
		return;
	}
	Sleep(KEY_WAIT);*/

	INPUT mi;
	memset(&mi, 0, sizeof(INPUT));
	mi.type = INPUT_KEYBOARD;
	mi.ki.wVk = vk;
	mi.ki.wScan = MapVirtualKey(vk, 0);
	switch (vk)
	{
	case VK_UP:
	case VK_DOWN:
	case VK_LEFT:
	case VK_RIGHT:
		mi.ki.dwFlags |= KEYEVENTF_EXTENDEDKEY;
		break;
	}
	
	S_SendInput(1, &mi, sizeof(INPUT));

	//memset(&mi, 0, sizeof(INPUT));
	//mi.type = INPUT_KEYBOARD;
	//mi.ki.wVk = vk;
	mi.ki.dwFlags |= KEYEVENTF_KEYUP;
	S_SendInput(1, &mi, sizeof(INPUT));
}

VBAEmulator::VBAEmulator()
	: m_hWnd(NULL)
{
	getWnd();
}

VBAEmulator::~VBAEmulator()
{
	printf("~VBAEmulator\n");
}

void VBAEmulator::getWnd()
{
	m_hWnd = ::FindWindow(L"VisualBoyAdvance-SDL", NULL);
	//m_hWnd = ::FindWindow(L"wxWindowNR", NULL);
	//m_hWnd = ::FindWindow(L"Afx:400000:0:0:1900011:590148f", NULL);
	printf("hWnd: 0x%08x\n", m_hWnd);
}

void VBAEmulator::setForeground()
{
	::SetForegroundWindow(m_hWnd);
	::SetFocus(m_hWnd);

	Sleep(KEY_WAIT);
}

void VBAEmulator::button_a()
{
	key_press(m_hWnd, 'Z');
}

void VBAEmulator::button_b()
{
	key_press(m_hWnd, 'X');
}

void VBAEmulator::button_l()
{
	key_press(m_hWnd, 'A');
}

void VBAEmulator::button_r()
{
	key_press(m_hWnd, 'S');
}

void VBAEmulator::button_up()
{
	key_press(m_hWnd, VK_UP);
}

void VBAEmulator::button_down()
{
	key_press(m_hWnd, VK_DOWN);
}

void VBAEmulator::button_left()
{
	key_press(m_hWnd, VK_LEFT);
}

void VBAEmulator::button_right()
{
	key_press(m_hWnd, VK_RIGHT);
}

void VBAEmulator::button_start()
{
	key_press(m_hWnd, VK_RETURN);
}

void VBAEmulator::button_select()
{
	key_press(m_hWnd, VK_BACK);
}

void VBAEmulator::Init(Handle<Object> exports)
{
	Isolate* isolate = Isolate::GetCurrent();

	Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
	tpl->SetClassName(String::NewFromUtf8(isolate, "VBAEmulator"));
	tpl->InstanceTemplate()->SetInternalFieldCount(1);

	NODE_SET_PROTOTYPE_METHOD(tpl, "screenshot", ScreenShot);
	NODE_SET_PROTOTYPE_METHOD(tpl, "start", ButtonStart);
	NODE_SET_PROTOTYPE_METHOD(tpl, "select", ButtonSelect);
	NODE_SET_PROTOTYPE_METHOD(tpl, "a", ButtonA);
	NODE_SET_PROTOTYPE_METHOD(tpl, "b", ButtonB);
	NODE_SET_PROTOTYPE_METHOD(tpl, "l", ButtonL);
	NODE_SET_PROTOTYPE_METHOD(tpl, "r", ButtonR);
	NODE_SET_PROTOTYPE_METHOD(tpl, "up", ButtonUp);
	NODE_SET_PROTOTYPE_METHOD(tpl, "down", ButtonDown);
	NODE_SET_PROTOTYPE_METHOD(tpl, "left", ButtonLeft);
	NODE_SET_PROTOTYPE_METHOD(tpl, "right", ButtonRight);

	constructor.Reset(isolate, tpl->GetFunction());
	exports->Set(String::NewFromUtf8(isolate, "VBAEmulator"), tpl->GetFunction());

	//init
	CoInitialize(NULL);
}

void VBAEmulator::New(const FunctionCallbackInfo<Value>& args)
{
	Isolate* isolate = args.GetIsolate();
	HandleScope scope(isolate);

	if (args.IsConstructCall())
	{
		VBAEmulator* obj = new VBAEmulator();
		obj->Wrap(args.This());
		args.GetReturnValue().Set(args.This());
	}
	else
	{
		const int argc = 0;
		//Local<Value> argv[argc] = {};
		Local<Function> cons = Local<Function>::New(isolate, constructor);
		//args.GetReturnValue().Set(cons->NewInstance(argc, argv));
		args.GetReturnValue().Set(cons->NewInstance(argc, NULL));
	}
}

void VBAEmulator::ScreenShot(const FunctionCallbackInfo<Value>& args)
{
	Isolate* isolate = args.GetIsolate();
	EscapableHandleScope scope(isolate);
	Local<Value> result; // default undefined

	if (args.Length() < 1 || args.Length() > 1)
	{
		isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Expected 1 argument", String::kInternalizedString)));
		scope.Escape(result);
		return;
	}

	if (!args[0]->IsFunction())
	{
		isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Argument 1 must be a function", String::kInternalizedString)));
		scope.Escape(result);
		return;
	}

	Local<Function> cb = Local<Function>::Cast(args[0]);

	VBAEmulator* vba = ObjectWrap::Unwrap<VBAEmulator>(args.Holder());
	vba->Ref();

	vba_t *baton = new vba_t();
	baton->vba = vba;
	baton->hWnd = vba->m_hWnd;
	baton->error = 0;
	baton->buf_ptr = NULL;
	baton->buf_len = 0;

	baton->cb.Reset(isolate, cb);

	uv_work_t *req = new uv_work_t;
	req->data = baton;

	uv_queue_work(uv_default_loop(), req, EIO_ScreenShot, EIO_AfterScreenShot);

	args.GetReturnValue().SetUndefined();
}

CLASS_MAP_KEY(start, ButtonStart);
CLASS_MAP_KEY(select, ButtonSelect);
CLASS_MAP_KEY(a, ButtonA);
CLASS_MAP_KEY(b, ButtonB);
CLASS_MAP_KEY(l, ButtonL);
CLASS_MAP_KEY(r, ButtonR);
CLASS_MAP_KEY(up, ButtonUp);
CLASS_MAP_KEY(down, ButtonDown);
CLASS_MAP_KEY(left, ButtonLeft);
CLASS_MAP_KEY(right, ButtonRight);

void VBAEmulator::EIO_ScreenShot(uv_work_t *req)
{
	vba_t *baton = static_cast<vba_t *>(req->data);
	
	baton->error = window_screenshot(baton->hWnd, &baton->buf_ptr, &baton->buf_len);
}

void VBAEmulator::EIO_AfterScreenShot(uv_work_t *req, int status)
{
	vba_t *baton = static_cast<vba_t *>(req->data);

	baton->vba->Unref();

	Local<Value> argv[2];

	Isolate* isolate = Isolate::GetCurrent(); // fixme, see: https://strongloop.com/strongblog/node-js-v0-12-c-apis-breaking/

											  // Add below line to fix error "Cannot create a handle without a HandleScope"
	HandleScope scope(isolate);
	argv[0] = Number::New(isolate, baton->error);
	//argv[1] = String::NewFromUtf8(isolate, baton->textresult, String::kInternalizedString, strlen(baton->textresult));
	if (baton->error == 0) {
		//argv[1] = ArrayBuffer::New(isolate, baton->buf_ptr, baton->buf_len, v8::ArrayBufferCreationMode::kInternalized);
		//Uint8Array::New(ab, 0, baton->buf_len);
		MaybeLocal<Object> buf = node::Buffer::New(isolate, (char *)baton->buf_ptr, baton->buf_len,
				Buffer_FreeCallback, NULL);
		buf.ToLocal(&argv[1]);
	}
	
	TryCatch try_catch;

	Handle<Context> context = isolate->GetCurrentContext();
	Handle<Function> callback = Local<Function>::New(isolate, baton->cb);
	
	callback->Call(context->Global(), baton->error == 0 ? 2 : 1, argv);

	delete baton;
	delete req;

	if (try_catch.HasCaught())
	{
		node::FatalException(isolate, try_catch);
	}
}

void VBAEmulator::Buffer_FreeCallback(char* data, void* hint)
{
	if (hint == NULL) {
		free(data);
	}
}