
import { useMemo } from "react";
import { Folder, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DeleteFolderDialog from "@/components/files/DeleteFolderDialog";

export type FolderNode = {
  id: string;
  name: string;
  parent_id: string | null;
  children?: FolderNode[];
};

type Props = {
  folders: { id: string; name: string; parent_id: string | null }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateClick?: (parentId: string | null) => void;
  canCreate?: boolean;
  canDelete?: boolean;
  companyId?: string;
  rootLabel?: string;
};

function buildTree(flat: Props["folders"]): FolderNode[] {
  const map = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];
  flat.forEach((f) => map.set(f.id, { ...f, children: [] }));
  flat.forEach((f) => {
    const node = map.get(f.id)!;
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function TreeItem({
  node,
  depth,
  selectedId,
  onSelect,
  onCreateClick,
  canCreate,
  canDelete,
  companyId,
}: {
  node: FolderNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateClick?: (parentId: string | null) => void;
  canCreate?: boolean;
  canDelete?: boolean;
  companyId?: string;
}) {
  const isSelected = selectedId === node.id;
  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-muted/50",
          isSelected && "bg-muted"
        )}
        style={{ paddingLeft: depth * 12 }}
        onClick={() => onSelect(node.id)}
      >
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{node.name}</span>
        <div className="ml-auto flex items-center gap-1">
          {canCreate && onCreateClick && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onCreateClick(node.id);
              }}
              title="Nova subpasta"
            >
              <FolderPlus className="h-3 w-3" />
            </Button>
          )}
          {canDelete && companyId && (
            <div onClick={(e) => e.stopPropagation()}>
              <DeleteFolderDialog
                folderId={node.id}
                folderName={node.name}
                companyId={companyId}
              />
            </div>
          )}
        </div>
      </div>
      {node.children && node.children.length > 0 && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onCreateClick={onCreateClick}
              canCreate={canCreate}
              canDelete={canDelete}
              companyId={companyId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({
  folders,
  selectedId,
  onSelect,
  onCreateClick,
  canCreate = false,
  canDelete = false,
  companyId,
  rootLabel = "Root",
}: Props) {
  const roots = useMemo(() => buildTree(folders), [folders]);
  // Caso não exista uma pasta "Root" no banco, mostramos as raízes disponíveis.
  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-muted/50",
          selectedId === null && "bg-muted"
        )}
        onClick={() => onSelect(null)}
      >
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{rootLabel}</span>
        {canCreate && onCreateClick && (
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onCreateClick(null);
            }}
            title="Nova pasta em raiz"
          >
            <FolderPlus className="h-3 w-3" />
          </Button>
        )}
      </div>

      {roots.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          depth={1}
          selectedId={selectedId}
          onSelect={onSelect}
          onCreateClick={onCreateClick}
          canCreate={canCreate}
          canDelete={canDelete}
          companyId={companyId}
        />
      ))}
    </div>
  );
}
