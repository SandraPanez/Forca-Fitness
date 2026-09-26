-- Este archivo contiene las sentencias SQL para crear las tablas necesarias para el módulo de matrículas.
-- Estos scripts deben ser ejecutados manualmente en PostgreSQL o a través de un cliente como pgAdmin/DBeaver.

-- 1. Tabla de Disciplinas
CREATE TABLE IF NOT EXISTS disciplinas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT
);

-- Insertar disciplinas por defecto (basado en los mockups)
INSERT INTO disciplinas (nombre, descripcion) VALUES
('Boxeo', 'Técnica y condición física'),
('Jiu Jitsu', 'Control y técnica de suelo'),
('MMA', 'Artes marciales mixtas'),
('Capoeira', 'Arte marcial afrobrasileña'),
('Cross Training', 'Preparación física integral')
ON CONFLICT DO NOTHING; -- Omitir si ya existen o usar un mecanismo similar.

-- (Solo disciplinas para T_04)

-- 2. Tabla de Estudiantes
CREATE TABLE IF NOT EXISTS estudiantes (
    id SERIAL PRIMARY KEY,
    tipo_documento VARCHAR(20) NOT NULL,
    numero_documento VARCHAR(50) UNIQUE NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    correo_electronico VARCHAR(150) NOT NULL,
    numero_celular VARCHAR(20),
    genero VARCHAR(20),
    direccion TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Matrículas
CREATE TABLE IF NOT EXISTS matriculas (
    id SERIAL PRIMARY KEY,
    estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    observaciones_medicas TEXT,
    fecha_matricula TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(50) DEFAULT 'REGISTRADA' -- Ej. REGISTRADA, PAGADA, ANULADA
);

-- 4. Tabla Intermedia Matrícula - Disciplinas (Para selección múltiple)
CREATE TABLE IF NOT EXISTS matricula_disciplinas (
    matricula_id INTEGER NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
    disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    PRIMARY KEY (matricula_id, disciplina_id)
);
