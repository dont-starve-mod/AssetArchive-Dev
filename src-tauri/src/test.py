import zipfile
import time

t = time.time()
for i in range(1000):
    if i % 100 == 0: print(i)
    with zipfile.ZipFile("./homura_0.zip") as f:
        f.read("homura_0-0.tex")

print("总耗时: %.2f ms" % ((time.time() -t)*1000))