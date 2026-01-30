document.addEventListener('DOMContentLoaded', () => {
    const calculateBtn = document.getElementById('calculate-btn');
    const salaryInput = document.getElementById('annual-salary');
    const dependentsInput = document.getElementById('dependents');

    const resultArea = document.getElementById('result-area');
    const monthlyNetSalaryEl = document.getElementById('monthly-net-salary');
    const annualNetSalaryEl = document.getElementById('annual-net-salary');
    const overallPercentileEl = document.getElementById('overall-percentile');
    const agePercentileEl = document.getElementById('age-percentile');
    const overallPercentileSubtext = document.getElementById('overall-percentile-subtext');
    const agePercentileSubtext = document.getElementById('age-percentile-subtext');
    const ageGroupSelect = document.getElementById('age-group-select');

    const percentileBaseTable = [
        { threshold: 1500000, percentile: 20 },
        { threshold: 2000000, percentile: 35 },
        { threshold: 2500000, percentile: 50 },
        { threshold: 3200000, percentile: 70 },
        { threshold: 4000000, percentile: 85 },
        { threshold: 5000000, percentile: 95 }
    ];

    const ageGroupMultiplier = {
        "20s": 0.85,
        "30s": 1.0,
        "40s": 1.1,
        "50s": 1.05,
        "60s": 0.9
    };

    const formatAsCurrency = (amount) => {
        return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + ' 원';
    };

    const getPercentileTableForAge = (ageGroup) => {
        const multiplier = ageGroupMultiplier[ageGroup] || 1;
        return percentileBaseTable.map((row) => ({
            threshold: row.threshold * multiplier,
            percentile: row.percentile
        }));
    };

    const computePercentile = (amount, table) => {
        let matched = { percentile: 0 };
        for (const row of table) {
            if (amount >= row.threshold) {
                matched = row;
            }
        }
        const percentile = matched.percentile;
        return {
            percentile,
            topPercent: Math.max(0, 100 - percentile)
        };
    };

    let latestMonthlyNetSalary = null;

    const updatePercentileDisplay = () => {
        if (!latestMonthlyNetSalary) {
            return;
        }

        const overall = computePercentile(latestMonthlyNetSalary, percentileBaseTable);
        overallPercentileEl.textContent = `상위 ${overall.topPercent}%`;
        overallPercentileSubtext.textContent = `하위 ${overall.percentile}% 기준`;

        const ageGroup = ageGroupSelect.value;
        const ageTable = getPercentileTableForAge(ageGroup);
        const agePercentile = computePercentile(latestMonthlyNetSalary, ageTable);
        agePercentileEl.textContent = `상위 ${agePercentile.topPercent}%`;
        agePercentileSubtext.textContent = `${ageGroupSelect.options[ageGroupSelect.selectedIndex].text} 기준`;
    };

    ageGroupSelect.addEventListener('change', updatePercentileDisplay);

    calculateBtn.addEventListener('click', () => {
        const annualSalaryInput = parseFloat(salaryInput.value);
        const dependents = parseInt(dependentsInput.value, 10);

        // 1. 입력값 검증
        if (isNaN(annualSalaryInput) || annualSalaryInput <= 0) {
            alert('올바른 연봉을 입력해주세요.');
            salaryInput.focus();
            return;
        }

        const annualSalary = annualSalaryInput * 10000;

        // 2. 공제액 계산 (단순화된 모델)
        const monthlySalary = annualSalary / 12;

        // 국민연금 (4.5%)
        const nationalPension = monthlySalary * 0.045;
        // 건강보험 (3.545%) + 장기요양 (건강보험의 12.81%)
        const healthInsurance = monthlySalary * 0.03545;
        const longTermCareInsurance = healthInsurance * 0.1281;
        // 고용보험 (0.9%)
        const employmentInsurance = monthlySalary * 0.009;

        // 소득세 (근로소득 간이세액표 기준 단순화)
        let incomeTax = 0;
        const taxBase = monthlySalary - (nationalPension + healthInsurance + employmentInsurance);
        
        // 부양가족 수에 따른 기본 공제 단순화
        const dependentDeduction = 150000 * (dependents - 1); 
        
        // 과세표준에 따른 세율 단순 적용
        if (taxBase > 8000000) {
            incomeTax = taxBase * 0.20 - dependentDeduction;
        } else if (taxBase > 4000000) {
            incomeTax = taxBase * 0.15 - dependentDeduction;
        } else if (taxBase > 1500000) {
            incomeTax = taxBase * 0.10 - dependentDeduction;
        } else {
            incomeTax = taxBase * 0.06 - dependentDeduction;
        }
        incomeTax = Math.max(0, incomeTax); // 세금은 음수가 될 수 없음

        // 지방소득세 (소득세의 10%)
        const localIncomeTax = incomeTax * 0.1;

        const totalMonthlyDeduction =
            nationalPension +
            healthInsurance +
            longTermCareInsurance +
            employmentInsurance +
            incomeTax +
            localIncomeTax;

        // 3. 실수령액 계산
        const monthlyNetSalary = monthlySalary - totalMonthlyDeduction;
        const annualNetSalary = monthlyNetSalary * 12;

        // 4. 결과 표시
        monthlyNetSalaryEl.textContent = formatAsCurrency(monthlyNetSalary);
        annualNetSalaryEl.textContent = formatAsCurrency(annualNetSalary);

        latestMonthlyNetSalary = monthlyNetSalary;
        updatePercentileDisplay();

        resultArea.style.display = 'block';
    });
});
