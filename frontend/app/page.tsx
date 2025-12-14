import React from 'react';
import { GitCommit, Star, Code, Award, Layout } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-300 font-mono">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-zinc-950 border-r border-zinc-800 p-6 flex flex-col gap-6">
          <div className="text-2xl font-bold text-white mb-6">DevDash_</div>
          <div className="flex items-center gap-3 text-white bg-zinc-800 p-2 rounded"><Layout size={18}/> Overview</div>
          <div className="flex items-center gap-3 hover:text-white"><Code size={18}/> Projects</div>
          <div className="flex items-center gap-3 hover:text-white"><Award size={18}/> Certificates</div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          <header className="flex justify-between items-end mb-12">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Alex Dev</h1>
              <p className="text-zinc-500">Senior Full Stack Engineer</p>
            </div>
            <button className="bg-white text-black px-6 py-2 rounded font-bold hover:bg-zinc-200">Download CV</button>
          </header>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-6 mb-12">
            <div className="bg-zinc-800/50 p-6 rounded-lg border border-zinc-800">
              <div className="text-zinc-500 text-sm mb-2">Total Commits</div>
              <div className="text-3xl font-bold text-white flex items-center gap-2">
                2,842 <GitCommit className="text-green-500" size={20}/>
              </div>
            </div>
            <div className="bg-zinc-800/50 p-6 rounded-lg border border-zinc-800">
              <div className="text-zinc-500 text-sm mb-2">GitHub Stars</div>
              <div className="text-3xl font-bold text-white flex items-center gap-2">
                145 <Star className="text-yellow-500" size={20}/>
              </div>
            </div>
          </div>

          {/* Activity Graph Simulation */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg mb-8">
             <h3 className="text-lg font-bold text-white mb-4">Contribution Activity</h3>
             <div className="flex gap-1 h-32 items-end">
                {[...Array(40)].map((_, i) => (
                  <div key={i} className="flex-1 bg-green-500/20 hover:bg-green-500 transition-colors rounded-t-sm" style={{height: `${Math.random() * 100}%`}}></div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </main>
  );
}
