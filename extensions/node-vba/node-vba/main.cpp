
typedef long long ssize_t;

#define BUILDING_NODE_EXTENSION
#include <node/node.h>
#pragma comment(lib, "node")

#include "vba.h"

using namespace v8;
using namespace node;

void init(Handle<Object> target)
{
	VBAEmulator::Init(target);
}

NODE_MODULE(vba, init)