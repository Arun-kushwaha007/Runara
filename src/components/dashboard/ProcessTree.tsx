import React from 'react';
import type { ProcessTreeNode } from '../../types';
import { CopyButton } from '../common/CopyButton';

interface ProcessTreeProps {
  tree: ProcessTreeNode[];
}

export const ProcessTree: React.FC<ProcessTreeProps> = ({ tree }) => {
  if (!tree || tree.length === 0) {
    return (
      <div className="text-xs text-zinc-500 italic py-2">
        Process ancestry information unavailable.
      </div>
    );
  }

  return (
    <div className="space-y-1 bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-4 font-mono text-xs overflow-x-auto">
      <div className="text-[11px] font-sans font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-blue-400"
        >
          <path d="M12 2v20" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        <span>Process Lineage Ancestry</span>
      </div>

      <div className="space-y-1.5">
        {tree.map((node, index) => {
          const isTarget = node.isTarget;
          const indentPixels = index * 18;

          return (
            <div
              key={`${node.pid}-${index}`}
              style={{ paddingLeft: `${indentPixels}px` }}
              className={`flex items-start gap-2 py-1.5 px-2 rounded-lg transition-colors group ${
                isTarget
                  ? 'bg-blue-950/40 border border-blue-600/40 text-blue-100 shadow-xs'
                  : 'text-zinc-300 hover:bg-zinc-900/60'
              }`}
            >
              {/* Connector Tree Symbol */}
              <div className="text-zinc-500 font-mono select-none shrink-0 pt-0.5">
                {index === 0 ? (
                  <span className="text-zinc-400 font-bold">●</span>
                ) : (
                  <span className="text-zinc-600">└──</span>
                )}
              </div>

              {/* Node Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`font-semibold ${
                      isTarget ? 'text-blue-300 font-bold' : 'text-zinc-200'
                    }`}
                  >
                    {node.name}
                  </span>

                  <span className="text-[11px] text-zinc-500 font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                    PID {node.pid}
                  </span>

                  {isTarget && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      Target Server Process
                    </span>
                  )}

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <CopyButton
                      textToCopy={node.pid.toString()}
                      label="PID"
                      title={`Copy PID ${node.pid}`}
                    />
                  </div>
                </div>

                {node.commandLine && (
                  <div
                    className="text-[11px] text-zinc-400 font-mono mt-0.5 truncate max-w-xl"
                    title={node.commandLine}
                  >
                    {node.commandLine}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
