# 便于测试共享内存
# 

from multiprocessing.shared_memory import SharedMemory
m = SharedMemory(create=True, size=16384, name='123')
buf = m.buf
