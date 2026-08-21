import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-6 py-32 text-center">
      <p className="font-mono text-mist-dim mb-2">SCENE NOT FOUND</p>
      <h1 className="font-display text-3xl font-semibold mb-6">This page isn't in frame.</h1>
      <Link to="/" className="text-canopy hover:underline font-medium">Back to home</Link>
    </div>
  );
}
