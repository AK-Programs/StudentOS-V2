/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Whiteboard Asset Library Dialog ("AI Board")
 * Displays verified 3D models and SVG diagrams with search and category filtering.
 * Zero arbitrary AI 3D generation.
 */

import React, { useState, useMemo } from 'react';
import { X, Search, Box, Image as ImageIcon, Sparkles, Plus, Check } from 'lucide-react';
import {
  ALL_VERIFIED_ASSETS,
  VerifiedAssetItem,
  searchVerifiedAssets
} from '../lib/whiteboardAssetRegistry';
import { Scene3DData } from './Whiteboard2';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd3DModel: (scene: Scene3DData) => void;
  onAddSvgDiagram: (svgString: string, title: string) => void;
  initialQuery?: string;
  initialCategory?: string;
}

export const WhiteboardAssetDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  onAdd3DModel,
  onAddSvgDiagram,
  initialQuery = '',
  initialCategory = 'All'
}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [addedAssetId, setAddedAssetId] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      if (initialQuery) setSearchQuery(initialQuery);
      if (initialCategory) setSelectedCategory(initialCategory);
    }
  }, [isOpen, initialQuery, initialCategory]);

  // Available categories based on actual verified assets
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    set.add('All');
    set.add('3D Models');
    set.add('SVGs');
    for (const asset of ALL_VERIFIED_ASSETS) {
      if (asset.subject) set.add(asset.subject);
    }
    return Array.from(set);
  }, []);

  // Filtered assets via instant local search
  const filteredAssets = useMemo(() => {
    return searchVerifiedAssets(searchQuery, selectedCategory);
  }, [searchQuery, selectedCategory]);

  const handleAddAsset = (asset: VerifiedAssetItem) => {
    if (asset.type === '3d' && asset.scene3D) {
      onAdd3DModel(asset.scene3D);
    } else if (asset.type === 'svg' && asset.svgContent) {
      onAddSvgDiagram(asset.svgContent, asset.title);
    }
    setAddedAssetId(asset.id);
    setTimeout(() => {
      setAddedAssetId(null);
      onClose();
    }, 450);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-slate-900 border border-indigo-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-scaleUp text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-white/10 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider font-display flex items-center gap-2">
                <span>AI Board</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-bold tracking-normal normal-case">
                  Verified Visuals
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Add verified educational visuals to your Whiteboard.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm cursor-pointer"
            title="Close Dialog"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Category Filters */}
        <div className="p-4 sm:p-6 pb-2 sm:pb-3 bg-slate-950/40 border-b border-white/5 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models and visuals (heart, biology, cell, geometry, physics, molecule, plant)..."
              className="w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-2xl bg-slate-950 border border-white/10 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs px-1.5 py-0.5 rounded-lg"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-bold">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-md scale-[1.02]'
                    : 'bg-slate-950 text-slate-400 border-white/10 hover:text-white hover:bg-slate-800'
                }`}
              >
                {cat === '3D Models' ? <Box className="w-3.5 h-3.5" /> : cat === 'SVGs' ? <ImageIcon className="w-3.5 h-3.5" /> : null}
                <span>{cat}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Asset Cards Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {filteredAssets.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-2 max-w-md mx-auto">
              <div className="h-12 w-12 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center text-slate-500 mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">No verified assets found.</h4>
              <p className="text-xs text-slate-400">
                Try another search term or category.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="mt-3 px-4 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredAssets.map((asset) => {
                const isAdded = addedAssetId === asset.id;
                return (
                  <div
                    key={asset.id}
                    className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 hover:border-indigo-500/50 transition-all space-y-3 flex flex-col justify-between group shadow-sm hover:shadow-indigo-500/10"
                  >
                    <div>
                      {/* Thumbnail Preview Area */}
                      <div className="w-full h-32 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center p-2 overflow-hidden relative group-hover:border-indigo-500/30 transition-colors">
                        <div
                          className="w-full h-full flex items-center justify-center pointer-events-none"
                          dangerouslySetInnerHTML={{ __html: asset.thumbnailSvg }}
                        />
                        {/* Type Badge */}
                        <div className="absolute top-2 right-2">
                          {asset.type === '3d' ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1 shadow-sm">
                              <Box className="w-3 h-3" />
                              <span>3D Model</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1 shadow-sm">
                              <ImageIcon className="w-3 h-3" />
                              <span>SVG Diagram</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Header & Meta */}
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                            {asset.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {asset.subject}
                          </span>
                          <span>•</span>
                          <span>{asset.category}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed pt-1">
                          {asset.description}
                        </p>
                      </div>
                    </div>

                    {/* Add Button */}
                    <button
                      onClick={() => handleAddAsset(asset)}
                      disabled={isAdded}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                        isAdded
                          ? 'bg-emerald-600 text-white'
                          : asset.type === '3d'
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/20'
                          : 'bg-violet-600 hover:bg-violet-500 text-white hover:shadow-violet-500/20'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Added to Board!</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Whiteboard</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>{filteredAssets.length} verified educational visual{filteredAssets.length === 1 ? '' : 's'}</span>
          <span>StudentOS Standard Asset Registry</span>
        </div>
      </div>
    </div>
  );
};
