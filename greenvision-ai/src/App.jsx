import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ModeProvider } from './context/ModeContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Upload from './pages/Upload';
import Processing from './pages/Processing';
import Dashboard from './pages/Dashboard';
import ClimateLab from './pages/ClimateLab';
import Planting from './pages/Planting';
import Advisor from './pages/Advisor';
import Reports from './pages/Reports';
import TemporalAnalysis from './pages/TemporalAnalysis';
import About from './pages/About';
import Contribute from './pages/Contribute';
import Leaderboard from './pages/Leaderboard';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <ModeProvider>
        <div className="min-h-screen flex flex-col font-body bg-ink light:bg-[#F4F7F4] text-mist light:text-ink transition-colors duration-300">
          <Navbar />
          <main className="flex-1 flex flex-col">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/processing" element={<Processing />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/climate-lab" element={<ClimateLab />} />
              <Route path="/planting" element={<Planting />} />
              <Route path="/advisor" element={<Advisor />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/temporal" element={<TemporalAnalysis />} />
              <Route path="/about" element={<About />} />
              <Route path="/contribute" element={<Contribute />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </ModeProvider>
    </BrowserRouter>
  );
}
