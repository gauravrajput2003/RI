from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, KeepTogether
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate
from reportlab.pdfbase.ttfonts import TTFont

out = r'D:\RI\Shubh_Tilak_Samagri_Expense_List.pdf'
pdfmetrics.registerFont(TTFont('Nirmala', r'C:\Windows\Fonts\Nirmala.ttc', subfontIndex=0))
cream=colors.HexColor('#FFF9EC'); saffron=colors.HexColor('#B65B16'); gold=colors.HexColor('#C49A45'); ink=colors.HexColor('#3E3428'); pale=colors.HexColor('#F7EBD2')
rows = [
('MARUKHOWA','2 KG'),('BACKING POWDER','4 DABBA'),('RITHA','2 KG'),('MARKIN','3 METER'),('HEDRO hadi ram','2 sisa'),('bhenela','2 shishi'),('tabak (chaudi)','200 pcs.'),('gulab jal','1 shisha'),('gadi burada','1 kg'),('suji','1 kg'),('chawal purana','60 kg'),('channa daal','15 kg'),('mung daal','1 kg'),('urad daal','6 kg'),('rahar daal','2 kg'),('aata sarotam','30 kg'),('beshan','15 kg'),('maida','20 kg'),('chini','150 kg'),('kaju','4 kg'),('kismish','1 kg'),('taalmakhana','2 kg'),('chhoti ilaichi','300 gram'),('keshar','5 pocket'),('papad bikaner','45 packet'),('chauretha','5 kg'),('chilli saush','6 bottle'),('soya saush','2 bottle'),('tamatar saus','2 bottle'),('ajinamoto','100 gram'),('posta dana','500 gram'),('kala namak','5 packet'),('namak','10 kg'),('daalda','1 tin'),('sarso tel','1 tin'),('ajanata pila rang','15 dabba'),('ajanta laal rang','15 dabba'),('magaj khira','500 gran'),('desi ghee','2 kg'),('badam daana','1 kg'),('rifaain','4 tin'),('thaali','1000 pcs'),('glass','2000 pcs'),('madhushudhan dudh','6 packet'),('paoroti churn','2 kg'),('chaumin','2 peti'),('samar','8 packet'),('aararot','500 gram'),('kaufi','500 gram'),('machis','1 packet'),('hing powder','1 kg'),('bada tokri','4 pcs'),('chaumin plate','1600 pcs'),('chaumin kaata','1600 pcs'),('namkin paper','5 packet'),('haldi gudi','1 kg'),('mircha gudi','1 kg'),('jira gudi','1 kg'),('khada jira','500 gram'),('golki gudi','1 kg'),('panchforan','200 gram'),('mangrailaa jawaiin','200 gram'),('sahjira','100 gram'),('lehsun','2 kg'),('kashmiri mirch (mdh)','300 gram'),('kasturi mirch mdh','6 packrt'),('garam masala mdh','300 gram'),('khada garam masala','500 gram'),('khada laal mirch','500 gram'),('khada dhaniyaa','500 gram'),('safed golki','100 gram'),('chaat masala mdh','6 packet'),('lavang bhashkar','300 gram'),('kitchen king masala','300 gram'),('safal mattar','20 kg'),('meat masala','300 gram'),('tej ptta','5 packet'),('roll paper','5 packet'),('aalu','50 kg'),('ghee','5 kg'),('nasta plate','600 pcs'),('pyaj','50 kg'),('mitha soda haldi raam','500 gram')]
styles=getSampleStyleSheet()
title=ParagraphStyle('title',fontName='Nirmala',fontSize=19,leading=25,textColor=saffron,alignment=TA_CENTER,spaceAfter=3)
subtitle=ParagraphStyle('sub',fontName='Nirmala',fontSize=11,leading=15,textColor=ink,alignment=TA_CENTER,spaceAfter=2)
small=ParagraphStyle('small',fontName='Nirmala',fontSize=8.5,leading=10.5,textColor=ink)

def page(c,doc):
    w,h=A4
    c.saveState(); c.setFillColor(cream); c.rect(0,0,w,h,fill=1,stroke=0)
    c.setStrokeColor(gold); c.setLineWidth(1.2); c.rect(9*mm,9*mm,w-18*mm,h-18*mm,fill=0,stroke=1)
    c.setStrokeColor(saffron); c.setLineWidth(.5); c.line(15*mm,17*mm,w-15*mm,17*mm)
    c.setFont('Nirmala',8); c.setFillColor(ink); c.drawCentredString(w/2,11.5*mm,f'Shubh Tilak Samagri & Expense List  •  Page {doc.page}')
    c.restoreState()

doc=SimpleDocTemplate(out,pagesize=A4,rightMargin=15*mm,leftMargin=15*mm,topMargin=13*mm,bottomMargin=22*mm,title='Shubh Tilak Samagri & Expense List')
story=[Paragraph('॥ श्री गणेशाय नमः ॥',subtitle),Spacer(1,2*mm),Paragraph('🌸 शुभ तिलक समारोह 🌸',title),Paragraph('दिनांक: 25 नवंबर 2026 (25 तारीख)',subtitle),Paragraph('तिलक सामग्री एवं खर्च विवरण',subtitle),Spacer(1,4*mm)]
data=[['क्रम संख्या','सामान का नाम','मात्रा (Quantity)','प्रति सामान मूल्य (₹)','कुल राशि (₹)']]
for i,(name,qty) in enumerate(rows,1): data.append([str(i),name,qty,'',''])
data.append(['','','','कुल खर्च',''])
t=Table(data,colWidths=[16*mm,61*mm,31*mm,38*mm,34*mm],repeatRows=1, hAlign='CENTER')
t.setStyle(TableStyle([
('BACKGROUND',(0,0),(-1,0),saffron),('TEXTCOLOR',(0,0),(-1,0),colors.white),('FONTNAME',(0,0),(-1,-1),'Nirmala'),('FONTSIZE',(0,0),(-1,0),8),('FONTSIZE',(0,1),(-1,-1),8.5),('LEADING',(0,0),(-1,-1),11),('ALIGN',(0,0),(0,-1),'CENTER'),('ALIGN',(2,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('GRID',(0,0),(-1,-1),.35,gold),('ROWBACKGROUNDS',(0,1),(-1,-2),[colors.white,colors.HexColor('#FFFCF5')]),('BACKGROUND',(0,-1),(-1,-1),pale),('TEXTCOLOR',(0,-1),(-1,-1),saffron),('FONTNAME',(3,-1),(-1,-1),'Nirmala'),('SPAN',(0,-1),(2,-1)),('ALIGN',(0,-1),(-1,-1),'RIGHT'),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4),
]))
story.append(t)
story.extend([Spacer(1,5*mm),Paragraph('🌺 कुल सामान का खर्च: ₹ __________ 🌺',ParagraphStyle('grand',fontName='Nirmala',fontSize=14,leading=20,textColor=saffron,alignment=TA_CENTER)),Spacer(1,2*mm),Paragraph('नोट: दरें उपलब्ध न होने के कारण प्रति सामान मूल्य एवं कुल राशि के खाने रिक्त रखे गए हैं। दरें भरने के बाद कुल खर्च जोड़ा जा सकता है।',ParagraphStyle('note',fontName='Nirmala',fontSize=8,leading=11,textColor=ink,alignment=TA_CENTER))])
doc.build(story,onFirstPage=page,onLaterPages=page)
print(f'Created {out}; entries={len(rows)}')
