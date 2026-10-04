const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /\{\/\* Tab: Blogs Tiers View \*\/\}\s*\{activeTab === 'blogs' && \(\s*<div className="space-y-6 animate-fadeIn">[\s\S]*?\}\s*\{\/\* Tab 3: Whiteboard \/ Smart Board Classroom - Full Screen Immersive \*\/\}/;

const blogContent = `{/* Tab: Blogs View */}
              {activeTab === 'blogs' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="text-center max-w-xl mx-auto space-y-2">
                    <span className="text-[11px] font-black uppercase text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">Educational Content</span>
                    <h3 className="text-3xl font-black font-display text-white tracking-tight">StudentOS Blogs & Insights</h3>
                    <p className="text-sm text-slate-400">Read the latest articles on learning strategies, EdTech, and student success.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    {/* Blog 1 */}
                    <div className="smart-glass p-6 rounded-2xl flex flex-col justify-between shadow-sm relative border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer group">
                      <div className="space-y-4">
                        <div className="aspect-video w-full rounded-xl bg-slate-800 mb-4 overflow-hidden">
                          <img src="https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=800&auto=format&fit=crop" alt="Blog 1" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" referrerPolicy="no-referrer" />
                        </div>
                        <div className="text-xs font-bold uppercase tracking-widest text-indigo-400">Study Strategies</div>
                        <h4 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">The Feynman Technique: Learn Faster</h4>
                        <p className="text-sm text-slate-400">Discover how explaining concepts simply can dramatically improve your retention and understanding of complex topics.</p>
                      </div>
                      <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
                        <span>By Dr. Sarah Jenkins</span>
                        <span>5 min read</span>
                      </div>
                    </div>

                    {/* Blog 2 */}
                    <div className="smart-glass p-6 rounded-2xl flex flex-col justify-between shadow-sm relative border border-white/5 hover:border-purple-500/30 transition-all cursor-pointer group">
                      <div className="space-y-4">
                        <div className="aspect-video w-full rounded-xl bg-slate-800 mb-4 overflow-hidden">
                          <img src="https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=800&auto=format&fit=crop" alt="Blog 2" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" referrerPolicy="no-referrer" />
                        </div>
                        <div className="text-xs font-bold uppercase tracking-widest text-purple-400">EdTech</div>
                        <h4 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">How AI is Reshaping Modern Classrooms</h4>
                        <p className="text-sm text-slate-400">An in-depth look at how personalized learning algorithms and AI tutors are helping students achieve better outcomes.</p>
                      </div>
                      <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
                        <span>By Alex Chen</span>
                        <span>8 min read</span>
                      </div>
                    </div>

                    {/* Blog 3 */}
                    <div className="smart-glass p-6 rounded-2xl flex flex-col justify-between shadow-sm relative border border-white/5 hover:border-amber-500/30 transition-all cursor-pointer group">
                      <div className="space-y-4">
                        <div className="aspect-video w-full rounded-xl bg-slate-800 mb-4 overflow-hidden">
                          <img src="https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800&auto=format&fit=crop" alt="Blog 3" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" referrerPolicy="no-referrer" />
                        </div>
                        <div className="text-xs font-bold uppercase tracking-widest text-amber-500">Productivity</div>
                        <h4 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">Building the Ultimate Student Routine</h4>
                        <p className="text-sm text-slate-400">Stop cramming and start planning. Learn how to construct a sustainable daily schedule for long-term success.</p>
                      </div>
                      <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
                        <span>By Marcus Doe</span>
                        <span>4 min read</span>
                      </div>
                    </div>

                    {/* Blog 4 */}
                    <div className="smart-glass p-6 rounded-2xl flex flex-col justify-between shadow-sm relative border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group">
                      <div className="space-y-4">
                        <div className="aspect-video w-full rounded-xl bg-slate-800 mb-4 overflow-hidden">
                          <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=800&auto=format&fit=crop" alt="Blog 4" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" referrerPolicy="no-referrer" />
                        </div>
                        <div className="text-xs font-bold uppercase tracking-widest text-blue-400">Collaboration</div>
                        <h4 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">The Power of Study Groups</h4>
                        <p className="text-sm text-slate-400">Why studying with peers can unlock new perspectives and keep you accountable during tough exam weeks.</p>
                      </div>
                      <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
                        <span>By Elena Rodriguez</span>
                        <span>6 min read</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Tab 3: Whiteboard / Smart Board Classroom - Full Screen Immersive */}`;

code = code.replace(regex, blogContent);
fs.writeFileSync('src/App.tsx', code);
