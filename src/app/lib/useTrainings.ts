import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type {
  Training,
  TrainingInsert,
  TrainingUpdate,
  Enrollment,
  EnrollmentInsert,
  EnrollmentUpdate,
} from "./database.types";

export type { Training, TrainingInsert, TrainingUpdate, Enrollment };

export interface TrainingWithEnrollments extends Training {
  enrollments: Enrollment[];
  total_inscritos: number;
  total_aprovados: number;
}

export function useTrainings() {
  const [trainings, setTrainings] = useState<TrainingWithEnrollments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("trainings")
        .select(`*, enrollments(*)`)
        .order("created_at", { ascending: false });

      if (err) throw err;

      const mapped: TrainingWithEnrollments[] = (data ?? []).map((t: any) => {
        const enrollments: Enrollment[] = t.enrollments ?? [];
        return {
          ...t,
          enrollments,
          total_inscritos: enrollments.length,
          total_aprovados: enrollments.filter((e) => e.status === "aprovado")
            .length,
        };
      });

      setTrainings(mapped);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar treinamentos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createTraining = useCallback(
    async (data: TrainingInsert): Promise<Training | null> => {
      const { data: inserted, error: err } = await supabase
        .from("trainings")
        .insert(data)
        .select()
        .single();

      if (err) {
        setError(err.message);
        return null;
      }

      const withEnrollments: TrainingWithEnrollments = {
        ...inserted,
        enrollments: [],
        total_inscritos: 0,
        total_aprovados: 0,
      };
      setTrainings((prev) => [withEnrollments, ...prev]);
      return inserted;
    },
    []
  );

  const updateTraining = useCallback(
    async (id: string, data: TrainingUpdate): Promise<boolean> => {
      const { error: err } = await supabase
        .from("trainings")
        .update(data)
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }
      await load();
      return true;
    },
    [load]
  );

  const removeTraining = useCallback(
    async (id: string): Promise<boolean> => {
      const { error: err } = await supabase
        .from("trainings")
        .delete()
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }
      setTrainings((prev) => prev.filter((t) => t.id !== id));
      return true;
    },
    []
  );

  const enroll = useCallback(
    async (data: EnrollmentInsert): Promise<Enrollment | null> => {
      // Check duplicate enrollment
      const training = trainings.find((t) => t.id === data.training_id);
      if (training) {
        const alreadyEnrolled = training.enrollments.find(
          (e) => e.participante_email === data.participante_email
        );
        if (alreadyEnrolled) {
          setError("Participante já inscrito neste treinamento.");
          return null;
        }
      }

      const { data: inserted, error: err } = await supabase
        .from("enrollments")
        .insert(data)
        .select()
        .single();

      if (err) {
        setError(err.message);
        return null;
      }

      setTrainings((prev) =>
        prev.map((t) =>
          t.id === data.training_id
            ? {
                ...t,
                enrollments: [...t.enrollments, inserted],
                total_inscritos: t.total_inscritos + 1,
              }
            : t
        )
      );
      return inserted;
    },
    [trainings]
  );

  const updateEnrollment = useCallback(
    async (id: string, trainingId: string, data: EnrollmentUpdate): Promise<boolean> => {
      const { error: err } = await supabase
        .from("enrollments")
        .update(data)
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }
      await load();
      return true;
    },
    [load]
  );

  const uploadMaterial = useCallback(
    async (file: File, trainingId: string): Promise<{ url: string | null; errorMsg: string | null }> => {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `trainings/${trainingId}/${Date.now()}.${ext}`;
      const { error: err } = await supabase.storage
        .from("Certifica Arquivos")
        .upload(path, file, { upsert: true });
      if (err) {
        console.error("[Storage upload error]", err);
        setError(err.message);
        return { url: null, errorMsg: err.message };
      }
      const { data } = supabase.storage.from("Certifica Arquivos").getPublicUrl(path);
      return { url: data.publicUrl, errorMsg: null };
    },
    []
  );

  const removeEnrollment = useCallback(
    async (id: string, trainingId: string): Promise<boolean> => {
      const { error: err } = await supabase
        .from("enrollments")
        .delete()
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }
      setTrainings((prev) =>
        prev.map((t) =>
          t.id === trainingId
            ? {
                ...t,
                enrollments: t.enrollments.filter((e) => e.id !== id),
                total_inscritos: Math.max(0, t.total_inscritos - 1),
              }
            : t
        )
      );
      return true;
    },
    []
  );

  return {
    trainings,
    loading,
    error,
    load,
    createTraining,
    updateTraining,
    removeTraining,
    enroll,
    updateEnrollment,
    removeEnrollment,
    uploadMaterial,
  };
}
