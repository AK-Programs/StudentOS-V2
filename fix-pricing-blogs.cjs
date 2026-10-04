const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace pricingPage with blogs in state setting and conditions
code = code.replace(/pricingPage/g, 'blogs');
// Replace "System Premium" with "Blogs" in Sidebar
code = code.replace(/System Premium/g, 'Blogs');
// Replace "Premium Upgrades" with "Blogs" in breadcrumbs
code = code.replace(/Premium Upgrades/g, 'Educational Blogs');

// Now, replace the tab content.
const startTabStr = "{/* Tab: Blogs Tiers View */}"; // was System Premium Tiers View
const endTabStr = "{/* Tab 3: Whiteboard / Smart Board Classroom - Full Screen Immersive */}";

// Let's check if the tab view is there. 
// Wait, when I replaced pricingPage to blogs, it replaced `activeTab === 'pricingPage'` with `activeTab === 'blogs'`
// And "System Premium Tiers View" got replaced to "Blogs Tiers View".
// Let's do this programmatically with a regex.

fs.writeFileSync('src/App.tsx', code);
