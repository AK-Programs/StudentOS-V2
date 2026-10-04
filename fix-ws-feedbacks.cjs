const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `          case 'whiteboard:clear':
          case 'whiteboard:cleared':
            clearLocalCanvas();
            break;
        }`;

const replacement = `          case 'whiteboard:clear':
          case 'whiteboard:cleared':
            clearLocalCanvas();
            break;
            
          case 'feedbacks:updated':
            if (data.payload?.feedbacks) {
              setFeedbackPosts(data.payload.feedbacks);
            }
            break;
        }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Added realtime for feedbacks');
} else {
  console.log('Could not find ws block');
}
