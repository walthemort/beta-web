import path from 'node:path';

/** Keep portal assets inside their build directory on Windows and POSIX. */
export function insideDirectory(folder,file,paths=path){
 const relative=paths.relative(folder,file);
 return relative!==''&&!paths.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+paths.sep);
}
