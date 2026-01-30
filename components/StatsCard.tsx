import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  color?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, trend, color = "text-crypto-400" }) => {
  return (
    <div className="bg-crypto-800 border border-crypto-700 rounded-lg p-5 flex items-start justify-between hover:border-crypto-500 transition-colors">
      <div>
        <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">{title}</p>
        <h3 className="text-3xl font-bold text-white mt-2">{value}</h3>
        {trend && <p className="text-emerald-500 text-xs mt-1">{trend}</p>}
      </div>
      <div className={`p-3 rounded-md bg-crypto-700/50 ${color}`}>
        <Icon size={24} />
      </div>
    </div>
  );
};