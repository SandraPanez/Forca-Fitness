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
