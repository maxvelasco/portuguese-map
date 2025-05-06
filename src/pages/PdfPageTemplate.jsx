const PdfPage = ({ title, filePath }) => {
  return (
    <div className="page-container">
      <h1>{title}</h1>
      <iframe
        src={filePath}
        // src="../docs/sobre-o-projeto.pdf"
        width="100%"
        height="90vh"
        style={{ border: "none" }}
        title={title}
      />
    </div>
  );
};

export default PdfPage;