-- Esquema PostgreSQL utilizado por la API de Forca-Fitness.

CREATE TABLE IF NOT EXISTS disciplinas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS estudiantes (
    id SERIAL PRIMARY KEY,
    tipo_documento VARCHAR(20) NOT NULL,
    numero_documento VARCHAR(50) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    correo_electronico VARCHAR(150),
    numero_celular VARCHAR(20),
    genero VARCHAR(20),
    direccion TEXT,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matriculas (
    id SERIAL PRIMARY KEY,
    estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    observaciones_medicas TEXT,
    fecha_matricula TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(50) NOT NULL DEFAULT 'REGISTRADA'
);

CREATE TABLE IF NOT EXISTS matricula_disciplinas (
    matricula_id INTEGER NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
    disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE RESTRICT,
    PRIMARY KEY (matricula_id, disciplina_id)
);

INSERT INTO disciplinas (nombre, descripcion) VALUES
    ('Boxeo', 'Técnica y condición física'),
    ('Jiu Jitsu', 'Control y técnica de suelo'),
    ('MMA', 'Artes marciales mixtas'),
    ('Capoeira', 'Arte marcial afrobrasileña'),
    ('Cross Training', 'Preparación física integral')
ON CONFLICT (nombre) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_matriculas_estudiante_id
    ON matriculas (estudiante_id);

CREATE INDEX IF NOT EXISTS idx_matricula_disciplinas_disciplina_id
    ON matricula_disciplinas (disciplina_id);
