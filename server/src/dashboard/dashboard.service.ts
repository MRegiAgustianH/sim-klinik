import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface DashboardMetrics {
  today: {
    date: string;
    totalPatients: number;
    completed: number;
    pending: number;
    approved: number;
    rejected: number;
    waitingApproval: number;
    patientsList: Array<{
      id: number;
      nik: string;
      fullName: string;
      gender: string;
      plannedTime: string;
      vaccineType: string;
      status: string;
      doctorApproval: string;
      pregnancyTestResult: string;
      icvNumber: string | null;
    }>;
  };
  monthly: {
    monthYear: string;
    totalPatients: number;
    completed: number;
    pending: number;
  };
  vaccineDistribution: Array<{
    vaccineType: string;
    count: number;
    percentage: number;
  }>;
  pregnancyTestSummary: {
    totalWus: number;
    negative: number;
    positive: number;
    notDone: number;
    records: Array<{
      id: number;
      nik: string;
      fullName: string;
      birthDate: string;
      plannedDate: string;
      vaccineType: string;
      pregnancyTestResult: string;
      doctorApproval: string;
      doctorNotes: string | null;
    }>;
  };
  stockOverview: {
    totalVaccineTypes: number;
    totalVaccineDoses: number;
    depletingVaccinesCount: number;
    expiredVaccinesCount: number;
    icvTotalStock: number;
    icvUsedStock: number;
    icvRemainingStock: number;
    vaccineAlerts: Array<{
      id: number;
      vaccineName: string;
      batchNumber: string;
      currentStock: number;
      expiryDate: string;
      status: string;
    }>;
  };
  monthlyTrend: Array<{
    month: string;
    total: number;
    completed: number;
  }>;
}

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  getDashboardMetrics(selectedDate?: string, selectedMonth?: string): DashboardMetrics {
    const todayStr = selectedDate || new Date().toISOString().split('T')[0];
    const monthStr = selectedMonth || todayStr.substring(0, 7);

    // 1. DATA HARIAN
    const todaySummary = this.db.get<{
      total: number;
      completed: number;
      pending: number;
      approved: number;
      rejected: number;
      waitingApproval: number;
    }>(
      `SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END), 0) as completed,
        COALESCE(SUM(CASE WHEN status = 'Belum' THEN 1 ELSE 0 END), 0) as pending,
        COALESCE(SUM(CASE WHEN doctorApproval = 'Disetujui' THEN 1 ELSE 0 END), 0) as approved,
        COALESCE(SUM(CASE WHEN doctorApproval = 'Ditolak' THEN 1 ELSE 0 END), 0) as rejected,
        COALESCE(SUM(CASE WHEN doctorApproval = 'Menunggu Persetujuan' THEN 1 ELSE 0 END), 0) as waitingApproval
      FROM vaccination_records WHERE plannedDate = ?`,
      [todayStr]
    );

    const todayPatients = this.db.query<{
      id: number;
      nik: string;
      fullName: string;
      gender: string;
      plannedTime: string;
      vaccineType: string;
      status: string;
      doctorApproval: string;
      pregnancyTestResult: string;
      icvNumber: string | null;
    }>(
      `SELECT id, nik, fullName, gender, plannedTime, vaccineType, status, doctorApproval, pregnancyTestResult, icvNumber
       FROM vaccination_records WHERE plannedDate = ? ORDER BY plannedTime ASC, id ASC`,
      [todayStr]
    );

    // 2. DATA BULANAN
    const monthlySummary = this.db.get<{
      total: number;
      completed: number;
      pending: number;
    }>(
      `SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END), 0) as completed,
        COALESCE(SUM(CASE WHEN status = 'Belum' THEN 1 ELSE 0 END), 0) as pending
      FROM vaccination_records WHERE monthYear = ?`,
      [monthStr]
    );

    // 3. DISTRIBUSI VAKSIN BULAN INI
    const vaccineCounts = this.db.query<{ vaccineType: string; count: number }>(
      `SELECT vaccineType, COUNT(*) as count
       FROM vaccination_records
       WHERE monthYear = ?
       GROUP BY vaccineType
       ORDER BY count DESC`,
      [monthStr]
    );

    const totalVaccinesMonth = vaccineCounts.reduce((acc, curr) => acc + curr.count, 0);
    const vaccineDistribution = vaccineCounts.map((v) => ({
      vaccineType: v.vaccineType,
      count: v.count,
      percentage: totalVaccinesMonth > 0 ? Math.round((v.count / totalVaccinesMonth) * 100) : 0,
    }));

    // 4. HASIL TES KEHAMILAN PADA WUS (Wanita Usia Subur)
    const wusCounts = this.db.get<{
      totalWus: number;
      negative: number;
      positive: number;
      notDone: number;
    }>(
      `SELECT
        COUNT(*) as totalWus,
        COALESCE(SUM(CASE WHEN pregnancyTestResult = 'Negatif' THEN 1 ELSE 0 END), 0) as negative,
        COALESCE(SUM(CASE WHEN pregnancyTestResult = 'Positif' THEN 1 ELSE 0 END), 0) as positive,
        COALESCE(SUM(CASE WHEN pregnancyTestResult = 'Tidak Dilakukan' THEN 1 ELSE 0 END), 0) as notDone
      FROM vaccination_records
      WHERE gender = 'Perempuan' AND monthYear = ?`,
      [monthStr]
    );

    const wusRecords = this.db.query<{
      id: number;
      nik: string;
      fullName: string;
      birthDate: string;
      plannedDate: string;
      vaccineType: string;
      pregnancyTestResult: string;
      doctorApproval: string;
      doctorNotes: string | null;
    }>(
      `SELECT id, nik, fullName, birthDate, plannedDate, vaccineType, pregnancyTestResult, doctorApproval, doctorNotes
       FROM vaccination_records
       WHERE gender = 'Perempuan' AND monthYear = ?
       ORDER BY plannedDate DESC, id DESC LIMIT 20`,
      [monthStr]
    );

    // 5. STOK OVERVIEW & ALERTS
    const today = new Date().toISOString().split('T')[0];

    const stockSum = this.db.get<{
      totalTypes: number;
      totalDoses: number;
      depleting: number;
      expired: number;
    }>(
      `SELECT
        COUNT(*) as totalTypes,
        COALESCE(SUM(currentStock), 0) as totalDoses,
        COALESCE(SUM(CASE WHEN (currentStock <= minStockAlert AND currentStock > 0 AND expiryDate >= ?) THEN 1 ELSE 0 END), 0) as depleting,
        COALESCE(SUM(CASE WHEN expiryDate < ? THEN 1 ELSE 0 END), 0) as expired
      FROM vaccine_stocks`,
      [today, today]
    );

    const icvStats = this.db.get<{
      totalStock: number;
      usedStock: number;
      remainingStock: number;
    }>(
      `SELECT
        COALESCE(SUM(totalStock), 0) as totalStock,
        COALESCE(SUM(usedStock), 0) as usedStock,
        COALESCE(SUM(remainingStock), 0) as remainingStock
      FROM icv_inventory`
    );

    const vaccineAlerts = this.db.query<{
      id: number;
      vaccineName: string;
      batchNumber: string;
      currentStock: number;
      expiryDate: string;
      status: string;
    }>(
      `SELECT id, vaccineName, batchNumber, currentStock, expiryDate, status
       FROM vaccine_stocks
       WHERE currentStock <= minStockAlert OR expiryDate < ?
       ORDER BY expiryDate ASC, currentStock ASC`,
      [today]
    );

    // 6. TREND BULANAN (6 bulan terakhir)
    const monthlyTrend = this.db.query<{
      month: string;
      total: number;
      completed: number;
    }>(
      `SELECT
        monthYear as month,
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END), 0) as completed
      FROM vaccination_records
      GROUP BY monthYear
      ORDER BY monthYear DESC
      LIMIT 6`
    ).reverse();

    return {
      today: {
        date: todayStr,
        totalPatients: todaySummary ? todaySummary.total : 0,
        completed: todaySummary ? todaySummary.completed : 0,
        pending: todaySummary ? todaySummary.pending : 0,
        approved: todaySummary ? todaySummary.approved : 0,
        rejected: todaySummary ? todaySummary.rejected : 0,
        waitingApproval: todaySummary ? todaySummary.waitingApproval : 0,
        patientsList: todayPatients,
      },
      monthly: {
        monthYear: monthStr,
        totalPatients: monthlySummary ? monthlySummary.total : 0,
        completed: monthlySummary ? monthlySummary.completed : 0,
        pending: monthlySummary ? monthlySummary.pending : 0,
      },
      vaccineDistribution,
      pregnancyTestSummary: {
        totalWus: wusCounts ? wusCounts.totalWus : 0,
        negative: wusCounts ? wusCounts.negative : 0,
        positive: wusCounts ? wusCounts.positive : 0,
        notDone: wusCounts ? wusCounts.notDone : 0,
        records: wusRecords,
      },
      stockOverview: {
        totalVaccineTypes: stockSum ? stockSum.totalTypes : 0,
        totalVaccineDoses: stockSum ? stockSum.totalDoses : 0,
        depletingVaccinesCount: stockSum ? stockSum.depleting : 0,
        expiredVaccinesCount: stockSum ? stockSum.expired : 0,
        icvTotalStock: icvStats ? icvStats.totalStock : 0,
        icvUsedStock: icvStats ? icvStats.usedStock : 0,
        icvRemainingStock: icvStats ? icvStats.remainingStock : 0,
        vaccineAlerts,
      },
      monthlyTrend,
    };
  }
}
