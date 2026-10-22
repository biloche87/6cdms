import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { Product, DropPoint } from '../../types/index.ts';
import {
  Package,
  PlusCircle,
  Search,
  Filter,
  Layers,
  X,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Edit2,
  Tag,
  Coins,
  Warehouse,
  Boxes,
  LayoutGrid,
  List,
} from 'lucide-react';

export const ProductsView: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedDropPoint, setSelectedDropPoint] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [formData, setFormData] = useState({
    name: '',
    reference: '',
    categoryId: 1,
    subCategory: '',
    unit: 'Sachet',
    unitsPerCarton: 48,
    unitPrice: 35000,
    dropPointId: user?.dropPointId || 1,
    initialStockQuantity: 50,
    alertThreshold: 20,
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    subCategory: '',
    unitsPerCarton: 48,
    unitPrice: 35000,
    status: 'ACTIF' as 'ACTIF' | 'INACTIF',
    dropPointId: 1,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, dpRes] = await Promise.all([
        api.getProducts(selectedDropPoint !== 'ALL' ? selectedDropPoint : undefined),
        api.getDropPoints(),
      ]);
      setProducts(prodRes?.products || []);
      const dps = dpRes?.dropPoints || [];
      setDropPoints(dps);
      if (dps.length > 0 && !formData.dropPointId) {
        setFormData((prev) => ({
          ...prev,
          dropPointId: user?.dropPointId || dps[0].id,
        }));
      }
    } catch (err) {
      console.error('Erreur chargement données catalogue:', err);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleStockUpdate = () => {
      loadData();
    };

    window.addEventListener('6c:stock-updated', handleStockUpdate);
    window.addEventListener('6c:sale-recorded', handleStockUpdate);

    return () => {
      window.removeEventListener('6c:stock-updated', handleStockUpdate);
      window.removeEventListener('6c:sale-recorded', handleStockUpdate);
    };
  }, [selectedDropPoint]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dropPointId) {
      alert('Veuillez sélectionner un Drop Point de rattachement.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await api.createProduct(formData);
      setMessage(res.message || `Produit '${formData.name}' ajouté et lié au Drop Point.`);
      setIsModalOpen(false);
      setFormData({
        name: '',
        reference: '',
        categoryId: 1,
        subCategory: '',
        unit: 'Sachet',
        unitsPerCarton: 48,
        unitPrice: 35000,
        dropPointId: user?.dropPointId || dropPoints[0]?.id || 1,
        initialStockQuantity: 50,
        alertThreshold: 20,
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erreur création produit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
    setEditFormData({
      name: prod.name || '',
      subCategory: prod.subCategory || (prod as any).sub_category || '',
      unitsPerCarton: prod.unitsPerCarton ?? (prod as any).units_per_carton ?? 1,
      unitPrice: prod.unitPrice ?? (prod as any).unit_price ?? 0,
      status: (prod.status || 'ACTIF') as 'ACTIF' | 'INACTIF',
      dropPointId: prod.dropPointId || dropPoints[0]?.id || 1,
    });
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      await api.updateProduct(editingProduct.id, editFormData);
      setMessage(`Produit '${editFormData.name}' mis à jour.`);
      setEditingProduct(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erreur mise à jour produit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    'ALL',
    ...Array.from(
      new Set(
        (products || [])
          .map((p) => p.categoryName || (p as any).category_name || 'Autre')
          .filter(Boolean)
      )
    ),
  ];

  const filteredProducts = (products || []).filter((p) => {
    const name = p.name || '';
    const ref = p.reference || '';
    const subCat = p.subCategory || (p as any).sub_category || '';
    const catName = p.categoryName || (p as any).category_name || 'Autre';
    const dpId = p.dropPointId || (p as any).drop_point_id;

    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subCat.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCat = selectedCategory === 'ALL' || catName === selectedCategory;
    const matchesDp =
      selectedDropPoint === 'ALL' || String(dpId) === String(selectedDropPoint);

    return matchesSearch && matchesCat && matchesDp;
  });

  const getPieceUnit = (prodName: string, unit?: string): { plural: string; singular: string } => {
    const lower = (prodName || '').toLowerCase();
    if (lower.includes('boîte') || lower.includes('boite') || lower.includes('bte')) {
      return { plural: 'boîtes', singular: 'boîte' };
    }
    if (lower.includes('sachet') || lower.includes('sach')) {
      return { plural: 'sachets', singular: 'sachet' };
    }
    if (lower.includes('stick')) {
      return { plural: 'sticks', singular: 'stick' };
    }
    if (lower.includes('pot')) {
      return { plural: 'pots', singular: 'pot' };
    }
    if (lower.includes('bouteille') || lower.includes('btl')) {
      return { plural: 'bouteilles', singular: 'bouteille' };
    }
    if (lower.includes('tablette')) {
      return { plural: 'tablettes', singular: 'tablette' };
    }
    if (unit && unit.toLowerCase() !== 'carton' && unit.toLowerCase() !== 'ctn') {
      return { plural: `${unit}s`, singular: unit };
    }
    return { plural: 'unités', singular: 'unité' };
  };

  const getCategoryColor = (catName: string) => {
    const lower = catName.toLowerCase();
    if (lower.includes('lait') || lower.includes('nido'))
      return 'text-amber-400 bg-amber-950/40 border-amber-800/50';
    if (lower.includes('café') || lower.includes('nescafé'))
      return 'text-red-400 bg-red-950/40 border-red-800/50';
    if (lower.includes('culinaire') || lower.includes('maggi'))
      return 'text-yellow-400 bg-yellow-950/40 border-yellow-800/50';
    return 'text-blue-400 bg-blue-950/40 border-blue-800/50';
  };

  const totalReferences = filteredProducts.length;
  const totalCartons = filteredProducts.reduce(
    (sum, p) => sum + (Number(p.availableStock) || 0),
    0
  );
  const totalStockValue = filteredProducts.reduce((sum, p) => {
    const price = Number(p.unitPrice ?? (p as any).unit_price ?? 0);
    const stock = Number(p.availableStock) || 0;
    return sum + stock * price;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Package className="w-7 h-7 text-red-500" />
            <span>Catalogue</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gamme de produits 6C Distribution rattachés aux Drop Points régionaux, conditionnements et stocks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Actualiser le catalogue"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {user?.role === 'SALES_ADMIN_NATIONAL' && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nouveau Produit</span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-red-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide truncate">
              Références
            </p>
            <p className="text-lg font-bold text-white font-mono">{totalReferences}</p>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide truncate">
              Stock Total
            </p>
            <p className="text-lg font-bold text-amber-400 font-mono">
              {totalCartons.toLocaleString('fr-FR')} <span className="text-xs text-slate-400 font-normal">cartons</span>
            </p>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide truncate">
              Valeur Stock HT
            </p>
            <p className="text-lg font-bold text-emerald-400 font-mono truncate">
              {totalStockValue.toLocaleString('fr-FR')} <span className="text-xs text-slate-400 font-normal">FCFA</span>
            </p>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Warehouse className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide truncate">
              Points de Dépôt
            </p>
            <p className="text-lg font-bold text-blue-400 font-mono">
              {dropPoints.length} <span className="text-xs text-slate-400 font-normal">sites</span>
            </p>
          </div>
        </div>
      </div>

      {/* Filter and View Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher référence, produit, marque..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <Warehouse className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedDropPoint}
                onChange={(e) => setSelectedDropPoint(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-red-500 transition"
              >
                <option value="ALL">Tous les Drop Points</option>
                {dropPoints.map((dp) => (
                  <option key={dp.id} value={dp.id}>
                    [{dp.code}] {dp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grille / Tableau Switcher */}
          <div className="flex items-center self-end sm:self-auto bg-slate-950 border border-slate-800 rounded-lg p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                viewMode === 'grid'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grille</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                viewMode === 'table'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tableau</span>
            </button>
          </div>
        </div>

        {/* Categories Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-t border-slate-800/80 pt-3">
          <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0 font-medium">
            <Filter className="w-3.5 h-3.5" /> Famille :
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium shrink-0 transition ${
                selectedCategory === cat
                  ? 'bg-red-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat === 'ALL' ? 'Toutes les familles' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalogue Content: Grid or Table */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-red-500" />
          <span className="text-xs">Chargement du catalogue produits...</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-16 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
          Aucun produit ne correspond aux filtres sélectionnés.
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Réf.</th>
                  <th className="py-3 px-4">Désignation</th>
                  <th className="py-3 px-4">Famille</th>
                  <th className="py-3 px-4">Drop Point</th>
                  <th className="py-3 px-4">Conditionnement</th>
                  <th className="py-3 px-4 text-center">Stock Cartons</th>
                  <th className="py-3 px-4 text-right">Prix Carton HT</th>
                  <th className="py-3 px-4 text-right">Prix / Unité</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  {user?.role === 'SALES_ADMIN_NATIONAL' && (
                    <th className="py-3 px-4 text-right">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredProducts.map((prod) => {
                  const price = Number(prod.unitPrice ?? (prod as any).unit_price ?? 0);
                  const units = prod.unitsPerCarton ?? (prod as any).units_per_carton ?? 1;
                  const categoryName = prod.categoryName ?? (prod as any).category_name ?? 'Gamme 6C';
                  const subCategory = prod.subCategory ?? (prod as any).sub_category ?? '';
                  const pieceUnit = getPieceUnit(prod.name, prod.unit);
                  const approxPerUnit = units > 0 ? Math.round(price / units) : 0;
                  const status = prod.status || 'ACTIF';
                  const dpName = prod.dropPointName || (prod as any).drop_point_name;
                  const dpCode = prod.dropPointCode || (prod as any).drop_point_code;
                  const stock = prod.availableStock !== undefined ? Number(prod.availableStock) : 0;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">
                          {prod.reference || `PRD-${prod.id}`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white text-sm">{prod.name}</div>
                        {subCategory && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{subCategory}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${getCategoryColor(
                            categoryName
                          )}`}
                        >
                          {categoryName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px]">
                          <Warehouse className="w-3 h-3 text-red-400 shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {dpName ? `${dpName} [${dpCode || 'DP'}]` : 'Drop Point DAKAN'}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-200 whitespace-nowrap">
                        {units} {pieceUnit.plural} / ctn
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold ${
                            stock > 10
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                              : stock > 0
                              ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                              : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                          }`}
                        >
                          {stock} cartons
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm whitespace-nowrap">
                        {price.toLocaleString('fr-FR')} FCFA
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300 text-xs whitespace-nowrap">
                        ~{approxPerUnit.toLocaleString('fr-FR')} FCFA / {pieceUnit.singular}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            status === 'ACTIF'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      {user?.role === 'SALES_ADMIN_NATIONAL' && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(prod)}
                            className="text-slate-400 hover:text-white inline-flex items-center gap-1 p-1 rounded hover:bg-slate-800 transition"
                            title="Modifier ce produit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW (OPTIMIZED SPACING & CARDS) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredProducts.map((prod) => {
            const price = Number(prod.unitPrice ?? (prod as any).unit_price ?? 0);
            const units = prod.unitsPerCarton ?? (prod as any).units_per_carton ?? 1;
            const categoryName = prod.categoryName ?? (prod as any).category_name ?? 'Gamme 6C';
            const subCategory = prod.subCategory ?? (prod as any).sub_category ?? '';
            const pieceUnit = getPieceUnit(prod.name, prod.unit);
            const approxPerUnit = units > 0 ? Math.round(price / units) : 0;
            const status = prod.status || 'ACTIF';
            const dpName = prod.dropPointName || (prod as any).drop_point_name;
            const dpCode = prod.dropPointCode || (prod as any).drop_point_code;
            const stock = prod.availableStock !== undefined ? Number(prod.availableStock) : 0;

            return (
              <div
                key={prod.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition group shadow-md"
              >
                <div>
                  {/* Top Bar: Reference & Category */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                      {prod.reference || `PRD-${prod.id}`}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${getCategoryColor(
                        categoryName
                      )}`}
                    >
                      {categoryName}
                    </span>
                  </div>

                  {/* Product Name */}
                  <h3 className="font-bold text-white text-sm group-hover:text-red-400 transition leading-snug line-clamp-2 min-h-[2.5rem]">
                    {prod.name}
                  </h3>

                  {/* SubCategory Tag */}
                  {subCategory ? (
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{subCategory}</span>
                    </p>
                  ) : (
                    <div className="h-4" />
                  )}

                  {/* Drop Point Liaison Badge */}
                  <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-[11px] text-slate-300">
                    <Warehouse className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="truncate">
                      {dpName ? `${dpName} [${dpCode || 'DP'}]` : 'Drop Point DAKAN [DKN]'}
                    </span>
                  </div>

                  {/* Data Rows */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2.5 text-xs">
                    {/* Conditionnement / Colisage */}
                    <div className="flex items-center justify-between gap-2 text-slate-400">
                      <span className="flex items-center gap-1.5 shrink-0">
                        <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        Conditionnement
                      </span>
                      <strong className="text-slate-100 font-mono font-bold whitespace-nowrap text-right">
                        {units} {pieceUnit.plural} / ctn
                      </strong>
                    </div>

                    {/* Stock disponible */}
                    <div className="flex items-center justify-between gap-2 text-slate-400">
                      <span className="flex items-center gap-1.5 shrink-0">
                        <Boxes className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        Stock disponible
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold whitespace-nowrap ${
                          stock > 10
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                            : stock > 0
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                            : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                        }`}
                      >
                        {stock} cartons
                      </span>
                    </div>

                    {/* Structured Pricing Box */}
                    <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl space-y-1.5 mt-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                          <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          Prix Carton HT
                        </span>
                        <span className="font-mono text-base font-black text-emerald-400 whitespace-nowrap">
                          {price.toLocaleString('fr-FR')} <span className="text-xs font-bold text-emerald-500">FCFA</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 text-[11px]">
                        <span className="text-slate-400 shrink-0">
                          Soit par {pieceUnit.singular} :
                        </span>
                        <span className="font-mono font-semibold text-slate-200 whitespace-nowrap">
                          ~{approxPerUnit.toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Bar: Status & Edit */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                  <span
                    className={`px-2 py-0.5 rounded font-semibold ${
                      status === 'ACTIF'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {status}
                  </span>

                  {user?.role === 'SALES_ADMIN_NATIONAL' && (
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(prod)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition"
                      title="Modifier ce produit"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Modifier</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Modal Nouveau Produit avec Liaison Drop Point Obligatoire */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] my-auto overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="flex-shrink-0 p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-red-500" />
                <span>Nouveau Produit & Liaison Drop Point</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="flex flex-col flex-1 overflow-hidden min-h-0 text-xs">
              <div className="overflow-y-auto p-5 space-y-4 flex-1">
              {/* Drop Point de Rattachement (Obligatoire) */}
              <div className="p-3 bg-red-950/20 border border-red-800/50 rounded-xl space-y-1.5">
                <label className="block text-red-300 font-semibold flex items-center gap-1.5">
                  <Warehouse className="w-4 h-4 text-red-400" />
                  <span>Drop Point (Dépôt) de Rattachement *</span>
                </label>
                <select
                  required
                  value={formData.dropPointId}
                  onChange={(e) =>
                    setFormData({ ...formData, dropPointId: parseInt(e.target.value, 10) })
                  }
                  className="w-full p-2.5 bg-slate-950 border border-red-900/50 rounded-lg text-white font-medium focus:ring-1 focus:ring-red-500"
                >
                  {dropPoints.length === 0 ? (
                    <option value="">Chargement des Drop Points...</option>
                  ) : (
                    dropPoints.map((dp) => (
                      <option key={dp.id} value={dp.id}>
                        [{dp.code}] {dp.name} - {dp.city} ({dp.neighborhood || dp.address})
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[11px] text-slate-400">
                  Le produit sera directement affecté au catalogue et aux stocks de ce Drop Point.
                </p>
              </div>

              {/* Informations Générales Produit */}
              <div>
                <label className="block text-slate-400 mb-1">Désignation Produit *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: NIDO Fortifiée Boîte 400g"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Référence SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: NID-B400-01"
                    value={formData.reference}
                    onChange={(e) =>
                      setFormData({ ...formData, reference: e.target.value.toUpperCase() })
                    }
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono uppercase placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Catégorie *</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) =>
                      setFormData({ ...formData, categoryId: parseInt(e.target.value, 10) })
                    }
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    <option value={1}>Lait & Produits Laitiers (NIDO)</option>
                    <option value={2}>Café & Boissons Chaudes (NESCAFÉ)</option>
                    <option value={3}>Culinaire & Bouillons (MAGGI)</option>
                    <option value={4}>Céréales Infantiles (CERELAC)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Sous-catégorie / Marque *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: NIDO Poudre, NESCAFÉ Classique, MAGGI Poulet..."
                  value={formData.subCategory}
                  onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Unités / Carton *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.unitsPerCarton}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        unitsPerCarton: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Prix Carton (FCFA) *</label>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    required
                    value={formData.unitPrice}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        unitPrice: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Unité élémentaire</label>
                  <input
                    type="text"
                    placeholder="Sachet, boîte..."
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Initialisation du Stock pour ce Drop Point */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold">
                  <Boxes className="w-3.5 h-3.5 text-amber-400" />
                  <span>Approvisionnement Initial au Drop Point</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Stock initial (en cartons)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.initialStockQuantity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          initialStockQuantity: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Seuil d'alerte stock (cartons)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formData.alertThreshold}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          alertThreshold: parseInt(e.target.value, 10) || 20,
                        })
                      }
                      className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                    />
                  </div>
                </div>
              </div>
              </div>

              <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-950/70 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50 shadow-md"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  <span>Créer & Rattaché au Drop Point</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Modification Produit */}
      {editingProduct && (
        <div
          onClick={() => setEditingProduct(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] my-auto overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="flex-shrink-0 p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-500" />
                <span>Modifier le Produit ({editingProduct.reference})</span>
              </h2>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateProduct} className="flex flex-col flex-1 overflow-hidden min-h-0 text-xs">
              <div className="overflow-y-auto p-4 space-y-3 flex-1">
              <div>
                <label className="block text-slate-400 mb-1">Désignation Produit *</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Drop Point de Rattachement</label>
                <select
                  value={editFormData.dropPointId}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      dropPointId: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                >
                  {dropPoints.map((dp) => (
                    <option key={dp.id} value={dp.id}>
                      [{dp.code}] {dp.name} - {dp.city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Sous-catégorie / Marque</label>
                <input
                  type="text"
                  value={editFormData.subCategory}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, subCategory: e.target.value })
                  }
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Unités par Carton *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editFormData.unitsPerCarton}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        unitsPerCarton: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Prix Carton (FCFA) *</label>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    required
                    value={editFormData.unitPrice}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        unitPrice: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Statut au Catalogue</label>
                <select
                  value={editFormData.status}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      status: e.target.value as 'ACTIF' | 'INACTIF',
                    })
                  }
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                >
                  <option value="ACTIF">ACTIF (disponible à la commande)</option>
                  <option value="INACTIF">INACTIF (archivé / suspendu)</option>
                </select>
              </div>
              </div>

              <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-950/70 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Mettre à jour</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
