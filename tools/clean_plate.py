import numpy as np, cv2
img=cv2.imread('src/reference-original.png')
H,W=img.shape[:2]
mask=np.zeros((H,W),np.uint8)
def textbox(x0,y0,x1,y1,thr=38):
    reg=img[y0:y1,x0:x1].astype(int)
    border=np.concatenate([reg[0],reg[-1],reg[:,0],reg[:,-1]])
    bg=np.median(border,axis=0)
    diff=np.abs(reg-bg).max(axis=2)
    m=(diff>thr).astype(np.uint8)*255
    m=cv2.dilate(m,np.ones((3,3),np.uint8),iterations=2)
    mask[y0:y1,x0:x1]=np.maximum(mask[y0:y1,x0:x1],m)
boxes=[
 (606,16,822,64),(1060,24,1160,48),(1222,24,1300,48),(1362,24,1458,48),
 (170,104,236,140),(170,140,224,162),(456,104,520,140),(704,104,776,140),(704,140,757,162),
 (982,104,1024,140),(982,145,1043,169),(1242,104,1290,140),(1242,145,1302,170),
 (212,276,302,302),(212,346,302,372),(212,416,302,442),(212,483,302,509),
 (198,716,252,762),(288,712,352,738),(166,882,226,910),(270,882,336,910),
 (333,403,370,426),(566,403,606,426),(778,403,814,426),(998,403,1036,426),
 (432,550,494,575),(655,550,717,575),(875,550,936,575),(1107,550,1170,575),
 (434,572,484,594),(662,572,708,594),(876,572,925,594),(1111,572,1161,594),
 (432,793,478,820),(584,793,626,820),(732,793,773,820),(895,793,937,820),(1067,793,1110,820),
 (416,900,496,926),(562,900,642,926),(712,900,792,926),(874,900,953,926),(1045,900,1123,926),
 (1438,500,1504,525),(1450,530,1504,553),(1444,557,1504,582),(1440,587,1504,610),
 (1195,783,1482,800),
 (1186,846,1502,880),(1186,882,1502,918),
 (197,982,278,1003),(507,982,550,1003),(842,982,888,1003),(1222,982,1287,1005),
]
for b in boxes: textbox(*b)
# trend lines: saturated pixels inside plot
hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV)
x0,y0,x1,y1=1206,684,1478,784
sat=((hsv[y0:y1,x0:x1,1]>90)&(hsv[y0:y1,x0:x1,2]>90)).astype(np.uint8)*255
sat=cv2.dilate(sat,np.ones((3,3),np.uint8),iterations=2)
mask[y0:y1,x0:x1]=np.maximum(mask[y0:y1,x0:x1],sat)
# gauge rings
yy,xx=np.mgrid[0:H,0:W]
for cx in [342,602,868,1144,1407]:
    d=np.hypot(xx-cx,yy-128)
    mask[(d>=30)&(d<=53)]=255
out=cv2.inpaint(img,mask,5,cv2.INPAINT_TELEA)
# level bars interior -> dark
for bx0,bx1 in [(342,355),(574,587),(789,803),(1008,1021)]:
    cv2.rectangle(out,(bx0,434),(bx1,512),(28,18,8),-1)
cv2.imwrite('src/clean.png',out)
cv2.imwrite('src/bg.webp',out,[cv2.IMWRITE_WEBP_QUALITY,90])
