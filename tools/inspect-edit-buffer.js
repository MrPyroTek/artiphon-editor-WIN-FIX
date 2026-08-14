const fs = require('fs');
const b = fs.readFileSync('resources/app-extracted/dist/bundle.js', 'utf8');
const i = b.indexOf("id:'edit_buffer'");
console.log('count', b.split("id:'edit_buffer'").length - 1);
let p = 0,
  c = 0;
while ((p = b.indexOf("id:'edit_buffer'", p)) >= 0 && c < 5) {
  console.log('\n===', p);
  console.log(b.slice(p - 80, p + 450));
  p += 10;
  c++;
}
