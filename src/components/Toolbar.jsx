import { Link } from "react-router-dom";
import "../App.css"; // Ensure styles are applied

const Toolbar = () => {
  return (
    <nav className="toolbar">
      <ul>
        <li><Link to="/">Mapas</Link></li>
        <li><Link to="/sobre">Sobre o Projeto</Link></li>
        <li><Link to="/intervencoes">Intervenções Artísticas</Link></li>
        <li><Link to="/podcasts">Podcasts</Link></li>
        <li><Link to="/entrevistas">Entrevistas</Link></li>
        <li><Link to="/video-ensaios">Vídeo-ensaios</Link></li>
        <li><Link to="/ensaios">Ensaios</Link></li>
        <li><Link to="/colaboradores">Colaboradores</Link></li>
        <li><Link to="/fale-conosco">Fale Conosco</Link></li>
      </ul>
    </nav>
  );
};

export default Toolbar;