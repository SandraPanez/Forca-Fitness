CREATE TABLE IF NOT EXISTS "Academia Forca&Fitness"."Usuario_Permiso" (
    "Id_Usuario" VARCHAR(10) NOT NULL,
    "Permiso" VARCHAR(50) NOT NULL,
    "Habilitado" BOOLEAN NOT NULL,

    CONSTRAINT "PK_Usuario_Permiso"
        PRIMARY KEY ("Id_Usuario", "Permiso"),

    CONSTRAINT "FK_Usuario_Permiso_Usuario"
        FOREIGN KEY ("Id_Usuario")
        REFERENCES "Academia Forca&Fitness"."Usuario" ("Id_Usuario")
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT "CK_Usuario_Permiso_Nombre"
        CHECK (BTRIM("Permiso") <> '')
);
