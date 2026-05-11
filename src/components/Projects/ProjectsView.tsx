import React, { useState, useEffect } from "react";
import {
  FolderOpen,
  Search,
  Calendar,
  User,
  Plus,
  ArrowRight,
  Trash2,
  Edit2,
  FileText,
  ClipboardList,
  Combine,
  CheckCircle2,
  Send,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  deleteDoc,
  updateDoc,
  doc,
  or,
  writeBatch,
  limit,
} from "firebase/firestore";
import { ProjectSpecificationModal } from "./ProjectSpecificationModal";

interface Project {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  data: any;
  status?: "draft" | "sent" | "transferred";
  sketches?: string[];
  specification?: any;
  sourceCompanyId?: string;
  sourceProjectId?: string;
  transferredAt?: string;
}

export const ProjectsView = ({
  companyId,
  userId,
  userRole,
  onLoadProject,
  onOpenSpecification,
  companyType,
  manufacturerId,
  showConfirm,
  onCreateSet,
}: {
  companyId?: string;
  userId?: string;
  userRole?: string;
  onLoadProject: (project: Project) => void;
  onOpenSpecification: (project: Project) => void;
  companyType?: string;
  manufacturerId?: string;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  onCreateSet?: (projects: Project[], set?: any) => void;
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingSets, setLoadingSets] = useState(true);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "draft" | "sent" | "transferred" | "sets"
  >("all");
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(
    new Set(),
  );
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleTransfer = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    if (!companyId) return;

    showConfirm(
      "Передача проекта",
      `Вы действительно хотите передать проект "${project.name}" руководителю? После передачи он появится во вкладке "Переданные".`,
      async () => {
        try {
          await updateDoc(
            doc(db, "companies", companyId, "projects", project.id),
            {
              status: "transferred",
              transferredAt: new Date().toISOString(),
            },
          );
          
          // Also transfer the set if it exists
          if (project.data?.setId) {
             await updateDoc(
              doc(db, "companies", companyId, "sets", project.data.setId),
              {
                status: "transferred",
                transferredAt: new Date().toISOString(),
              },
            );
          }
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.UPDATE,
            `companies/${companyId}/projects/${project.id}`,
          );
        }
      },
    );
  };

  const handleTransferSet = async (e: React.MouseEvent, set: any) => {
    e.stopPropagation();
    if (!companyId) return;

    showConfirm(
      "Передача комплекта",
      `Вы действительно хотите передать комплект "${set.name}" руководителю?`,
      async () => {
        try {
          const batch = writeBatch(db);
          
          batch.update(doc(db, "companies", companyId, "sets", set.id), {
            status: "transferred",
            transferredAt: new Date().toISOString(),
          });
          
          // Also transfer all projects in the set
          if (set.projectIds && set.projectIds.length > 0) {
            for (const pId of set.projectIds) {
              batch.update(doc(db, "companies", companyId, "projects", pId), {
                status: "transferred",
                transferredAt: new Date().toISOString(),
              });
            }
          }
          
          await batch.commit();
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.UPDATE,
            `companies/${companyId}/sets/${set.id}`,
          );
        }
      },
    );
  };
  const handleRenameSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingProjectId || !companyId || !editingName.trim()) {
      setEditingProjectId(null);
      return;
    }

    try {
      await updateDoc(
        doc(db, "companies", companyId, "projects", editingProjectId),
        {
          name: editingName.trim(),
        },
      );
      setEditingProjectId(null);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `companies/${companyId}/projects/${editingProjectId}`,
      );
    }
  };

  useEffect(() => {
    if (!companyId) return;

    let qProjects;
    let qSets;

    if (userRole === "admin") {
      // Admin sees all projects of the company
      qProjects = query(
        collection(db, "companies", companyId, "projects"),
        orderBy("createdAt", "desc"),
        limit(40),
      );
      qSets = query(
        collection(db, "companies", companyId, "sets"),
        orderBy("createdAt", "desc"),
        limit(40),
      );
    } else if (userRole === "supervisor") {
      // Supervisor sees their own projects AND any transferred projects
      qProjects = query(
        collection(db, "companies", companyId, "projects"),
        or(where("createdBy", "==", userId), where("status", "==", "transferred")),
        orderBy("createdAt", "desc"),
        limit(40),
      );
      qSets = query(
        collection(db, "companies", companyId, "sets"),
        or(where("createdBy", "==", userId), where("status", "==", "transferred")),
        orderBy("createdAt", "desc"),
        limit(40),
      );
    } else {
      // Employees see only their own projects
      qProjects = query(
        collection(db, "companies", companyId, "projects"),
        where("createdBy", "==", userId),
        orderBy("createdAt", "desc"),
        limit(40),
      );
      qSets = query(
        collection(db, "companies", companyId, "sets"),
        where("createdBy", "==", userId),
        orderBy("createdAt", "desc"),
        limit(40),
      );
    }

    const unsubscribeProjects = onSnapshot(
      qProjects,
      (snapshot) => {
        const projs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Project,
        );
        setProjects(projs);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `companies/${companyId}/projects`,
        );
        setLoading(false);
      },
    );

    const unsubscribeSets = onSnapshot(
      qSets,
      (snapshot) => {
        const projs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSets(projs);
        setLoadingSets(false);
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `companies/${companyId}/sets`,
        );
        setLoadingSets(false);
      },
    );

    return () => {
      unsubscribeProjects();
      unsubscribeSets();
    };
  }, [companyId, userId, userRole]);

  const toggleProjectSelection = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    const newSelection = new Set(selectedProjectIds);
    if (newSelection.has(projectId)) {
      newSelection.delete(projectId);
    } else {
      newSelection.add(projectId);
    }
    setSelectedProjectIds(newSelection);
    if (newSelection.size > 0) {
      setIsSelectionMode(true);
    } else {
      setIsSelectionMode(false);
    }
  };

  const handleCreateSet = () => {
    const selectedProjects = projects.filter((p) =>
      selectedProjectIds.has(p.id),
    );
    if (onCreateSet) {
      onCreateSet(selectedProjects);
    }
    // Reset selection
    setSelectedProjectIds(new Set());
    setIsSelectionMode(false);
  };

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!companyId) return;

    showConfirm(
      "Удаление проекта",
      "Вы уверены, что хотите удалить этот проект?",
      async () => {
        try {
          await deleteDoc(
            doc(db, "companies", companyId, "projects", projectId),
          );
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.DELETE,
            `companies/${companyId}/projects/${projectId}`,
          );
        }
      },
    );
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.createdByName?.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeFilter === "all") return matchesSearch;
    return matchesSearch && (p.status || "draft") === activeFilter;
  });

  const filteredSets = sets.filter((s) => {
    return (
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contractNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Проекты {activeFilter === "sets" && "и Комплекты"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSelectionMode && activeFilter !== "sets" && (
              <button
                onClick={handleCreateSet}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 animate-in zoom-in duration-300"
              >
                <Combine className="w-4 h-4" />
                Создать комплект ({selectedProjectIds.size})
              </button>
            )}

            <div className="relative w-full md:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Поиск..."
              />
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl">
              {(["all", "draft", "sent", "transferred", "sets"] as const).map(
                (filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setActiveFilter(filter);
                      setIsSelectionMode(false);
                      setSelectedProjectIds(new Set());
                    }}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                      activeFilter === filter
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700",
                    )}
                  >
                    {filter === "all"
                      ? "Все"
                      : filter === "draft"
                        ? "Черновики"
                        : filter === "sent"
                          ? "Оформленные"
                          : filter === "sets"
                            ? "Комплекты"
                            : "Переданные"}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {activeFilter === "sets" ? (
          loadingSets ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredSets.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center shadow-sm">
              <Combine className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Комплектов не найдено
              </h2>
              <p className="text-gray-500">
                В этой категории пока нет комплектов
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSets.map((set) => (
                <div
                  key={set.id}
                  className="group bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all relative overflow-hidden"
                >
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {/* Only selection icons if any */}
                  </div>

                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white">
                      <Combine className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0 pr-24">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors min-w-0">
                          {set.name || "Комплект"}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 flex-shrink-0">
                          {set.projectIds?.length || 0} шт
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        Сумма: {(set.totalPrice || 0).toLocaleString()} ₽
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50">
                    {set.status !== "transferred" && (
                      <button
                        onClick={(e) => handleTransferSet(e, set)}
                        title="Передать руководителю"
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!companyId) return;
                        const newSelection = new Set<string>(set.projectIds || []);
                        setSelectedProjectIds(newSelection);
                        setIsSelectionMode(true);
                        setActiveFilter("all");
                      }}
                      title="Дособрать комплект"
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const setProjects = projects.filter((p) => (set.projectIds || []).includes(p.id));
                        if (onCreateSet && setProjects.length > 0) onCreateSet(setProjects, set);
                      }}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold"
                    >
                      <FileText className="w-4 h-4" />
                      Спецификация
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!companyId) return;
                        showConfirm("Удаление", "Удалить комплект?", async () => {
                          try {
                            await deleteDoc(doc(db, "companies", companyId, "sets", set.id));
                          } catch (error) {
                            handleFirestoreError(error, OperationType.DELETE, `companies/${companyId}/sets/${set.id}`);
                          }
                        });
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center shadow-sm">
            <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Проектов не найдено
            </h2>
            <p className="text-gray-500">В этой категории пока нет проектов</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() =>
                  isSelectionMode
                    ? toggleProjectSelection({} as any, project.id)
                    : onLoadProject(project)
                }
                className={cn(
                  "group bg-white p-6 rounded-3xl border transition-all cursor-pointer relative overflow-hidden",
                  selectedProjectIds.has(project.id)
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg"
                    : "border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200",
                )}
              >
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button
                      onClick={(e) => toggleProjectSelection(e, project.id)}
                      className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                        selectedProjectIds.has(project.id)
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-white border-gray-200 text-transparent hover:border-indigo-400 opacity-0 group-hover:opacity-100",
                      )}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-start gap-4 mb-4">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all",
                      project.status === "sent"
                        ? "bg-orange-50 text-orange-600"
                        : project.status === "transferred"
                          ? "bg-green-50 text-green-600"
                          : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
                    )}
                  >
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0 pr-16">
                    <div className="flex items-center gap-2 mb-1">
                      {editingProjectId === project.id ? (
                        <form
                          onSubmit={handleRenameSubmit}
                          className="flex-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleRenameSubmit()}
                            className="w-full px-2 py-1 text-sm font-bold border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          />
                        </form>
                      ) : (
                        <h3
                          className="font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors cursor-text min-w-0"
                          title="Нажмите, чтобы переименовать"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProjectId(project.id);
                            setEditingName(project.name);
                          }}
                        >
                          {project.name}
                        </h3>
                      )}
                      {project.status && project.status !== "draft" && (
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider flex-shrink-0",
                            project.status === "sent"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-green-100 text-green-700",
                          )}
                        >
                          {project.status === "sent" ? "Оформлен" : "Передан"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(project.createdAt).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-auto gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-500">
                      {project.createdByName?.charAt(0) || "U"}
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium truncate">
                      {project.createdByName || "Пользователь"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {project.status === "sent" && (
                      <button
                        onClick={(e) => handleTransfer(e, project)}
                        title="Передать руководителю"
                        className="p-1 px-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {(userRole === "manager" || userRole === "admin") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSpecification(project);
                        }}
                        className="p-1 px-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        {project.status === "sent" ||
                        project.status === "transferred"
                          ? "Спецификация"
                          : "Оформить"}
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, project.id)}
                      className="p-1 px-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Normal open behavior (usually click on card handles it, but explicit button is good)
                        onOpenSpecification(project);
                      }}
                      className="flex items-center gap-1 px-2 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-all group/open ml-1"
                    >
                      Открыть <ArrowRight className="w-3 h-3 group-hover/open:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
