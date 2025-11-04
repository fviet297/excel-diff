import React from 'react';
import { Mail, Phone, Linkedin, Github } from 'lucide-react';

export default function AppFooter() {
  return (
    <footer className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            <a href="mailto:fviet295@gmail.com" className="hover:underline transition">fviet295@gmail.com</a>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            <span>0937 088 941</span>
          </div>
          <div className="flex items-center gap-2">
            <Linkedin className="w-5 h-5" />
            <a href="https://www.linkedin.com/in/vietdp" target="_blank" rel="noopener noreferrer" className="hover:underline transition">
              https://www.linkedin.com/in/vietdp
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            <a href="https://github.com/fviet297" target="_blank" rel="noopener noreferrer" className="hover:underline transition">
              https://github.com/fviet297
            </a>
          </div>
        </div>
        <div className="text-center text-xs mt-4 opacity-80">
          © Da Nang 2025 Excel Git Diff Tool. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
