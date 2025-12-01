import React from 'react';
import { Github, Linkedin, Facebook, Globe, Cpu, Code, Zap } from 'lucide-react';

const DeveloperInfo: React.FC = () => {
    return (
        <div className="border-t border-[#00E5FF] border-opacity-20 pt-4 relative overflow-hidden group">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00E5FF]/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none"></div>

            <div className="flex flex-col items-center gap-3 relative z-10">
                <div className="flex items-center gap-2 text-[#00E5FF] mb-1">
                    <Cpu className="w-4 h-4 animate-pulse" />
                    <span className="text-xs font-bold tracking-[0.2em] uppercase opacity-70">System Architect</span>
                    <Cpu className="w-4 h-4 animate-pulse" />
                </div>

                <h2 className="text-xl font-bold text-white tracking-wider relative">
                    <span className="relative z-10">ZAHID HASAN TONMOY</span>
                    <span className="absolute -inset-1 bg-[#00E5FF] blur-lg opacity-20 animate-pulse"></span>
                </h2>

                <div className="flex gap-4 mt-2">
                    <SocialLink href="https://github.com/zahidhasantonmoy" icon={Github} label="GITHUB" />
                    <SocialLink href="https://www.linkedin.com/in/zahidhasantonmoy/" icon={Linkedin} label="LINKEDIN" />
                    <SocialLink href="https://www.facebook.com/zahidhasantonmoybd" icon={Facebook} label="FACEBOOK" />
                    <SocialLink href="https://zahidhasantonmoy.vercel.app" icon={Globe} label="PORTFOLIO" />
                </div>

                <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                    <Code className="w-3 h-3" />
                    <span>CODED_WITH_</span>
                    <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400 animate-bounce" />
                    <span>_IN_FUTURE</span>
                </div>
            </div>
        </div>
    );
};

const SocialLink: React.FC<{ href: string; icon: React.ElementType; label: string }> = ({ href, icon: Icon, label }) => (
    <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group/link relative p-2 rounded-full border border-gray-800 hover:border-[#00E5FF] hover:bg-[#00E5FF]/10 transition-all duration-300"
        title={label}
    >
        <Icon className="w-4 h-4 text-gray-400 group-hover/link:text-[#00E5FF] transition-colors" />
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-[#00E5FF] opacity-0 group-hover/link:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-mono tracking-wider">
            {label}
        </span>
    </a>
);

export default DeveloperInfo;
