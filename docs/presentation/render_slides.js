// Render every slide of a .pptx to PNG with the installed PowerPoint (PowerShell COM fails on this PC; WSH works).
// Usage: cscript //nologo render_slides.js <absolute .pptx> <absolute out dir>deck.png  -> <out dir>deck<Slide N>.PNG
var args = WScript.Arguments;
var app = new ActiveXObject("PowerPoint.Application");
var p = app.Presentations.Open(args(0), true, false, false);
p.SaveCopyAs(args(1), 18); // ppSaveAsPNG: one PNG per slide in a folder
WScript.Echo("saved " + p.Slides.Count);
p.Close();
app.Quit();
