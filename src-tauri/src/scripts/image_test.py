import cv2
import subprocess
import os

img = cv2.imread("test1.png")
print(img)
exit()
img1 = Image.new("RGBA", (4, 4), (200,0,0,200))
img2 = img1.transform((8, 8), Image.AFFINE, [1,0,-2,0,1.5,-2], Image.BILINEAR)

def pprint_img(img):
	*_, img = img.split()
	w, h = img.size
	print("===== Image =====")
	for y in range(h):
		for x in range(w):
			print("%4d" % img.getpixel((x, y)), end = "")
		print("")
	print("")

if __name__ == '__main__':
	pprint_img(img1)
	pprint_img(img2)
	img1.save("test1.png")
	img2.save("test2.png")