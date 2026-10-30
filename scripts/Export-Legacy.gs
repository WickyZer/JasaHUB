/** ONE-TIME EXPORT ONLY. Paste into the OLD bound Apps Script project.
 * Run exportJASAhubMigration(), download the ZIP from your Drive, then remove it
 * after migration. This export contains PRIVATE customer data and old passwords.
 * It is not required by the new website after cutover.
 */
function exportJASAhubMigration(){
 const props=PropertiesService.getScriptProperties();
 const id=props.getProperty('SPREADSHEET_ID')||SpreadsheetApp.getActiveSpreadsheet().getId();
 const ss=SpreadsheetApp.openById(id),names=['Products','Categories','Packages','Previews','Orders','Users','Media','Settings'];
 const records={},blobs=[],missing=[];
 names.forEach(name=>{
  const sheet=ss.getSheetByName(name);if(!sheet)throw Error('Tab tidak tersedia: '+name);
  const grid=sheet.getDataRange().getValues(),headers=grid.shift();
  records[name]=grid.filter(row=>row[0]!==''&&row[0]!==null).map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i] instanceof Date?row[i].toISOString():row[i]])));
 });
 records.Media.forEach(row=>{
  try{
   if(!/^[A-Za-z0-9_-]{10,100}$/.test(String(row.fileId)))throw Error('ID media tidak valid');
   const extension=row.mime==='image/jpeg'?'jpg':row.mime==='image/webp'?'webp':'png';
   const path='media/'+row.fileId+'.'+extension;
   blobs.push(DriveApp.getFileById(String(row.fileId)).getBlob().setName(path));row.exportPath=path;
  }catch(error){missing.push(String(row.fileId));}
 });
 blobs.push(Utilities.newBlob(JSON.stringify({format:'jasahub-legacy-v1',exportedAt:new Date().toISOString(),records,missingMedia:missing},null,2),'application/json','data.json'));
 const file=DriveApp.createFile(Utilities.zip(blobs,'JASAhub-private-export.zip'));
 Logger.log('Unduh ZIP pribadi dari Drive Anda: '+file.getUrl());
 Logger.log('Media gagal diekspor: '+missing.length+'. Jangan publikasi ZIP ini.');
}
